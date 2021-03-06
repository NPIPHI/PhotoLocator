import GeoJSON from "ol/format/GeoJSON";
import { Feature } from "ol";
import { Circle, Geometry, Point } from "ol/geom";
import proj4 from "proj4";
import * as shapefile from "shapefile"
import { extension_of } from "./FileHandling";
import Style from "ol/style/Style";
import Text from "ol/style/Text";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";
import VectorSource from "ol/source/Vector";
import VectorImageLayer from "ol/layer/VectorImage";

/**
 * Loads a projection from a .prj file
 * @param file File to load projection information from
 * @param dest_projection Destination projection
 * @returns proj4 projection from src to dest
 */
async function load_projection(file: FileSystemFileHandle, dest_projection: string): Promise<proj4.Converter> {
    const decoder = new TextDecoder();
    const proj_str = decoder.decode(await (await file.getFile()).arrayBuffer());
    const projection = proj4(proj_str, dest_projection);

    return projection;
}

/**
 * Feature with dbf data attached
 */
export type DbfFeature = Feature<Geometry> & { dbf_properties?: any, is_start_stop?: boolean, parent_shapefile: Shapefile }


/**
 * Loads one shape and associated metadata from a folder
 * @param filename Name of the shape file (not including .shp)
 * @param dest_projection Destination projection of the shape file
 * @param folder Folder containing the .shp, .prj and .dbf files
 * @returns shapefile object
 */
async function load_shapefile(filename: string, dest_projection: string, folder: FileSystemHandle[]): Promise<Shapefile> {
    const proj_file = <FileSystemFileHandle>folder.find(f => f.name == `${filename}.prj`);
    const shape_file = <FileSystemFileHandle>folder.find(f => f.name == `${filename}.shp`);
    const dbf_file = <FileSystemFileHandle>folder.find(f => f.name == `${filename}.dbf`);

    const projection = await (async () => {
        if (!proj_file) {
            console.warn(`file ${filename}.prj not found defaulting to EPSG:3857`);
            return proj4("EPSG:3857", dest_projection);
        } else {
            return await load_projection(proj_file, dest_projection);
        }
    })()

    const contents = await (await shape_file.getFile()).arrayBuffer();
    const dbf = await (async () => {
        if (dbf_file) {
            return await (await dbf_file.getFile()).arrayBuffer();
        } else {
            console.warn(`file ${filename}.dbf not found, metadata missing`);
            return null;
        }
    })();
    const shapes = await shapefile.read(contents, dbf);
    if (shapes.bbox) {
        shapes.bbox = null;
    }

    shapes.features.forEach(f => {
        if (f.bbox) f.bbox = null;
        if (f.geometry.type == "Point") {
            f.geometry.coordinates = projection.forward(f.geometry.coordinates);
        } else if (f.geometry.type == "Polygon" || f.geometry.type == "MultiLineString") {
            for (let i = 0; i < f.geometry.coordinates.length; i++) {
                for (let j = 0; j < f.geometry.coordinates[i].length; j++) {
                    f.geometry.coordinates[i][j] = projection.forward(f.geometry.coordinates[i][j])
                }
            }
        } else if (f.geometry.type == "MultiPolygon") {
            for (let i = 0; i < f.geometry.coordinates.length; i++) {
                for (let j = 0; j < f.geometry.coordinates[i].length; j++) {
                    for (let k = 0; k < f.geometry.coordinates[i][j].length; k++) {
                        f.geometry.coordinates[i][j][k] = projection.forward(f.geometry.coordinates[i][j][k])
                    }
                }
            }
        } else if (f.geometry.type == "LineString" || f.geometry.type == "MultiPoint") {
            for (let i = 0; i < f.geometry.coordinates.length; i++) {
                f.geometry.coordinates[i] = projection.forward(f.geometry.coordinates[i])
            }
        } else {
            throw `bad shape type: ${f.geometry.type}`
        }
    })

    const geo_json = <DbfFeature[]>await new GeoJSON().readFeatures(shapes);

    for (let i = 0; i < geo_json.length; i++) {
        geo_json[i].dbf_properties = shapes.features[i].properties
    }

    const dbf_props = Object.keys(shapes.features[0]?.properties);

    return new Shapefile(filename, geo_json, dbf_props, dbf_file);
}

/**
 * Loads all shapefiles from a folder
 * @param dest_projection destination projection of loaded shape files
 * @param folder folder to load shapefiles from
 * @returns array of shapefiles
 */
export async function load_shapefiles(dest_projection: string, folder: FileSystemHandle[], to_load: string[]): Promise<Shapefile[]> {
    const shape_file_names = to_load.map(f => f.slice(0, f.length - ".shp".length));

    return Promise.all(shape_file_names.map(name=>{
        return load_shapefile(name, dest_projection, folder);
    }));
}

/**
 * Represents the set of all features from a shapefile as well as its associated openlayers objects
 */
export class Shapefile {
    layer: VectorImageLayer<VectorSource>;
    vector_source: VectorSource;
    private visible_props: string[] = [];
    private line_width: number;
    private highlighted: DbfFeature[] = [];

    /**
     * Construct shapefile
     * @param name name of the shapefile
     * @param features array of features
     * @param props array of available dbf properties on those features
     * @param dbf_file dbf file (so that the shapefile can save changes to dbf features)
     */
    constructor(public name : string, public features: DbfFeature[], public props: string[], private dbf_file: FileSystemFileHandle){
        features.forEach(f=>f.parent_shapefile=this);
        this.line_width = 2;
        this.set_visible_props([]);
        this.vector_source = new VectorSource({
            features: this.features,
        })

        this.layer = new VectorImageLayer({
            source: this.vector_source,
        })
    }

    /**
     * Get the text to display given the current visible props
     * @param feature feature to style
     * @param visible_props list of visible props on that feature
     * @returns Text to display
     */
    private text_of(feature: DbfFeature, visible_props: string[]){
        let text = visible_props.map(name => {
            const val = feature.dbf_properties[name];
            if (val === undefined || val === null) {
                return `[MISSING ${name}]`;
            } else {
                return val;
            }
        }).join('-');

        if(text.length > 40){
            return text.slice(0, 37) + "...";
        } else {
            return text;
        }
    }

    private text_style(feature: DbfFeature, props: string[]){
        return new Style({
            text: new Text({
                text: this.text_of(feature, props),
                font: "bold 20px Calibri",
                stroke: new Stroke({
                    color: [255,255,255]
                }),
                overflow: true,
                fill: new Fill({ color: [0,0,255] }),
            })
        })
    }

    private color_of_section(sectionid: string){
        return [0, 128, 0];
    }

    /**
     * Base style of features that are not highlighted or focused
     * @param feature feature to style
     * @returns Base style of feature
     */
    private base_style(feature: DbfFeature): Style {
        const geo = feature.getGeometry();
        if(geo.getType() == "Point"){
            const pt = (geo as Point).getFlatCoordinates();

            if(feature.dbf_properties.SectionID){ 
                if(feature.dbf_properties.SectionID == "Deleted"){
                    return new Style({
                        stroke: new Stroke({
                            width: this.line_width,
                            color: "black"
                        }),
                        fill: new Fill({
                            color: "gray"
                        }),
                        geometry: new Circle(pt, 1)
                    })
                } else {
                    const color = this.color_of_section(feature.dbf_properties.SectionID);
                    return new Style({
                        stroke: new Stroke({
                            width: this.line_width,
                            color: feature.is_start_stop ? [0, 255, 0] : color
                        }),
                        fill: new Fill({
                            color: color
                        }),
                        geometry: new Circle(pt, 2)
                    })
                } 
            } else {
                return new Style({
                    stroke: new Stroke({
                        width: this.line_width,
                        color: 'blue'
                    }),
                    fill: new Fill({
                        color: "lightblue"
                    }),
                    geometry: new Circle(pt, 2)
                })
            }
        } else {
            return new Style({
                stroke: new Stroke({
                    width: this.line_width,
                    color: this.color_of_section(feature.dbf_properties.UniqueID)
                })
            })
        }
    }

    /**
     * Restyles all features with the current style set by the features section id and highlighted status
     * 
     * Necessary when changing section ids of features by not calling set style on each changed feature
     */
    restyle_all(){
        this.features.forEach(f=>{
            f.setStyle([this.base_style(f), this.text_style(f, this.visible_props)]);
        })
    }

    set_visible_props(props: string[]){
        this.visible_props = props;
        this.restyle_all();
    }

    set_visible(visible: boolean){
        this.layer.setVisible(visible);
    }

    set_line_width(width: number){
        this.line_width = width;
        this.restyle_all();
    }
}


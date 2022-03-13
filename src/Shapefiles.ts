import GeoJSON from "ol/format/GeoJSON";
import { Feature } from "ol";
import { Geometry } from "ol/geom";
import proj4 from "proj4";
import * as shapefile from "shapefile"
import { extension_of } from "./file_handling";

async function load_projection(file: FileSystemFileHandle, dest_projection: string): Promise<proj4.Converter> {
    const decoder = new TextDecoder();
    const proj_str = decoder.decode(await (await file.getFile()).arrayBuffer());
    const projection = proj4(proj_str, dest_projection);

    return projection;
}


export type DbfFeature = Feature<Geometry> & {dbf_properties?: any}

async function load_shapefile(filename: string, dest_projection: string, folder: FileSystemHandle[]): Promise<{features: DbfFeature[], dbf_props: string[]}>{
    const proj_file = <FileSystemFileHandle>folder.find(f=>f.name == `${filename}.prj`);
    const shape_file = <FileSystemFileHandle>folder.find(f=>f.name == `${filename}.shp`);
    const dbf_file = <FileSystemFileHandle>folder.find(f=>f.name == `${filename}.dbf`);

    const projection = await (async ()=>{
        if(!proj_file){
            console.warn(`file ${filename}.prj not found defaulting to EPSG:3857`);
            return proj4("EPSG:3857", dest_projection);
        } else {
            return await load_projection(proj_file, dest_projection);
        }
    })()
    
    const contents = await (await shape_file.getFile()).arrayBuffer();
    const dbf = await (async ()=>{
        if(dbf_file){
            return await (await dbf_file.getFile()).arrayBuffer();
        } else {
            console.warn(`file ${filename}.dbf not found, metadata missing`);
            return null;
        }
    })();
    const shapes = await shapefile.read(contents, dbf);
    if(shapes.bbox){
        shapes.bbox = null;
    }

    shapes.features.forEach(f=>{
        if(f.bbox) f.bbox = null;
        if(f.geometry.type == "Point"){
            f.geometry.coordinates = projection.forward(f.geometry.coordinates);
        } else if(f.geometry.type == "Polygon"){
            for(let i = 0; i < f.geometry.coordinates.length; i++){
                for(let j = 0; j < f.geometry.coordinates[i].length; j++){
                    f.geometry.coordinates[i][j] = projection.forward(f.geometry.coordinates[i][j])
                }
            }
        } else if(f.geometry.type == "MultiPolygon"){
            for(let i = 0; i < f.geometry.coordinates.length; i++){
                for(let j = 0; j < f.geometry.coordinates[i].length; j++){
                    for(let k = 0; k < f.geometry.coordinates[i][j].length; k++){
                        f.geometry.coordinates[i][j][k] = projection.forward(f.geometry.coordinates[i][j][k])
                    }
                }
            }
        } else if(f.geometry.type == "LineString" || f.geometry.type == "MultiPoint"){
            for(let i = 0; i < f.geometry.coordinates.length; i++){
                f.geometry.coordinates[i] = projection.forward(f.geometry.coordinates[i])
            }
        } else {
            throw `bad shape type: ${f.geometry.type}` 
        }
    })

    const geo_json = <DbfFeature[]>await new GeoJSON({featureProjection: "ESRI:102671"}).readFeatures(shapes);

    for(let i = 0; i < geo_json.length; i++){
        geo_json[i].dbf_properties = shapes.features[i].properties
    }

    const dbf_props = Object.keys(shapes.features[0]?.properties);

    return {features: geo_json, dbf_props: dbf_props};
}

export async function load_shapefiles(filename: string, dest_projection: string, folder: FileSystemHandle[]): Promise<{shapefiles: {name: string, features: DbfFeature[]}[], props: string[]}>{
    const shape_file_names = folder.filter(f=>{
        if(f instanceof FileSystemFileHandle){
            return extension_of(f) == "shp";
        } else {
            return false;
        }
    }).map(f=>f.name.slice(0, f.name.length - ".shp".length));

    let props: string[] = [];
    let shapefiles: {
        name: string;
        features: DbfFeature[];
    }[] = [];

    for(const name of shape_file_names){
        const shapes = await load_shapefile(name, dest_projection, folder);
        shapefiles.push({features: shapes.features, name: name});
        shapes.dbf_props.forEach(p=>{
            if(props.indexOf(p) == -1) props.push(p);
        });
        
    }

    return {shapefiles: shapefiles, props: props};
}
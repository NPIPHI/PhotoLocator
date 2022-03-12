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

async function load_shapefile(filename: string, dest_projection: string, folder: FileSystemHandle[]): Promise<Feature<Geometry>[]>{
    const proj_file = <FileSystemFileHandle>folder.find(f=>f.name == `${filename}.prj`);
    const shape_file = <FileSystemFileHandle>folder.find(f=>f.name == `${filename}.shp`);
    const projection = await (async ()=>{
        if(!proj_file){
            console.warn(`file ${filename}.prj not found defaulting to EPSG:3857`);
            return proj4("EPSG:3857", dest_projection);
        } else {
            return await load_projection(proj_file, dest_projection);
        }
    })()
    
    const contents = await (await shape_file.getFile()).arrayBuffer();
    const shapes = await shapefile.read(contents);
    if(shapes.bbox){
        shapes.bbox = null;
    }

    shapes.features.forEach(f=>{
        if(f.bbox) f.bbox = null;
        if(f.geometry.type == "Polygon"){
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
        }else {
            throw `bad shape type: ${f.geometry.type}` 
        }
    })

    return await new GeoJSON({featureProjection: "ESRI:102671"}).readFeatures(shapes);
}

export async function load_shapefiles(filename: string, dest_projection: string, folder: FileSystemHandle[]): Promise<Feature<Geometry>[]>{
    const shape_files = folder.filter(f=>{
        if(f instanceof FileSystemFileHandle){
            return extension_of(f) == "shp";
        } else {
            return false;
        }
    }).map(f=>f.name.slice(0, f.name.length - ".shp".length));

    let ret: Feature<Geometry>[] = [];
    for(const name of shape_files){
        const shapes = await load_shapefile(name, dest_projection, folder);
        shapes.forEach(s=>ret.push(s));
    }

    return ret;
}
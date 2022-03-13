import { Feature } from "ol";
import { Geometry, Point } from "ol/geom";
import VectorSource from "ol/source/Vector";
import { to_array_buffer, to_base64 } from "./Base64";
import { extension_of } from "./file_handling"
import { fromLonLat, toLonLat } from "ol/proj";
import { Icon, Style, Stroke, Text, Fill } from "ol/style";
import VectorLayer from "ol/layer/Vector";
const piexif = require("piexifjs");

export class ImageIcon {
    feature: Feature<Point>;
    image_url: string;
    image_name: string;
    constructor(lat: number, lon: number, img_url: string, img_name: string, change_location_callback: (lat: number, lon: number)=>void){
        this.image_url = img_url;
        this.image_name = img_name;
        this.feature = new Feature({
            geometry: new Point(
                fromLonLat([lon,lat])
            )
        });
        this.feature.on('change', evt=>{
            const coords = this.feature.getGeometry().getFlatCoordinates();
            const [lon, lat] = toLonLat(coords);
            change_location_callback(lat, lon);
        });

        this.setStyleIcon();
    }

    private text_style(text: string): Style {
        return new Style({
            text:new Text({
                text: text,
                font: 'bold 20px Times New Roman',
                offsetY: 25,
                fill: new Fill({color: 'rgb(0,0,0)'}),
                stroke: new Stroke({color: 'rgb(255,255,255)', width: 1})
            })
        })
    }

    setStyleIcon(){
        this.feature.setStyle([this.text_style(this.image_name), image_style("./image_marker.png")]);
    }

    setStyleThumbnail(){
        this.feature.setStyle([this.text_style(this.image_name), image_style(this.image_url)]);
    }
}

function to_img_url(image_contents: ArrayBuffer): string {
    const blob = new Blob( [ image_contents ] );
    return URL.createObjectURL( blob );
}

function style(feature: any): Style {
    return styles.image;
}

function point_style(image_url: string): Style {
    return new Style({
        geometry: new Point([0,0])
    })
}

function image_style(image_url: string){
    return new Style({
        image: new Icon({
            anchor: [0.5,0.5],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction',
            src: image_url,
            scale: 0.1,
        }),
    });
}

const styles = {
    image: new Style({
        stroke: new Stroke({
            color: 'red',
            width: 100,
        })
    })
}

type Dms = [[number,number],[number,number],[number,number]];

function to_dms(deg_float: number): Dms {
    const minFloat = deg_float % 1 * 60;
    const secFloat = minFloat % 1 * 60;
    const deg = Math.floor(deg_float);
    const min = Math.floor(minFloat);
    const sec = Math.round(secFloat * 1000);

    return [[deg, 1], [min, 1], [sec, 1000]];
}

function from_dms(dms: Dms, ref: string): number {
    const sign = (ref === 'S' || ref === 'W') ? -1.0 : 1.0;
    const deg = sign * (dms[0][0] / dms[0][1] +
              dms[1][0] / dms[1][1] / 60.0 +
              dms[2][0] / dms[2][1] / 3600.0);

    return deg;
}

export async function save_exif_data(file: FileSystemFileHandle, lat: number, lon: number){
    const bin = await load_file(file);
    const exif = load_exif(bin);
    
    const lat_arr = to_dms(lat);
    const lon_arr = to_dms(Math.abs(lon));
    
    exif.GPS[piexif.GPSIFD.GPSLatitude] = lat_arr;
    exif.GPS[piexif.GPSIFD.GPSLatitudeRef] = lat > 0 ? "N" : "S";
    exif.GPS[piexif.GPSIFD.GPSLongitude] = lon_arr;
    exif.GPS[piexif.GPSIFD.GPSLongitudeRef] = lon > 0 ? "E" : "W";

    exif.thumbnail = null;
    const new_file = insert_exif(bin, exif);

    const writeable = await file.createWritable();
    writeable.write(new_file);
    writeable.close();
} 

async function load_file(file: FileSystemFileHandle): Promise<ArrayBuffer> {
    return await( await file.getFile()).arrayBuffer();
}

function load_exif(data: ArrayBuffer): any {
    const b64 = to_base64(data);
    return piexif.load("data:image/jpeg;base64,"+b64);
}

function insert_exif(data: ArrayBuffer, exif: any): ArrayBuffer {
    const exif_bin = piexif.dump(exif);
    const data64 = to_base64(data);
    const new_file = piexif.insert(exif_bin, "data:image/jpeg;base64,"+data64);
    return to_array_buffer(new_file.slice("data:image/jpeg;base64,".length));
}

export async function load_images(folder: FileSystemHandle[]): Promise<{layer: VectorLayer<VectorSource<Geometry>>, modifications: Map<FileSystemFileHandle, [number, number]>, icons: ImageIcon[]}> {
    const files = <FileSystemFileHandle[]>folder.filter(f=>f.kind == "file");

    let icons = [];
    let mod_map = new Map();
    for(const f of files){
        const extension = extension_of(f);
        if(extension == "jpeg" || extension == "jpg"){
            const contents = await( await f.getFile()).arrayBuffer();
            const url = to_img_url(contents);
            const exif = await load_exif(contents);
            if(exif.GPS && (typeof exif.GPS[2] == 'object') && (typeof exif.GPS[4] == 'object')) {
                const lat = from_dms(exif.GPS[piexif.GPSIFD.GPSLatitude], exif.GPS[piexif.GPSIFD.GPSLatitudeRef]);
                const lon = from_dms(exif.GPS[piexif.GPSIFD.GPSLongitude], exif.GPS[piexif.GPSIFD.GPSLongitudeRef]);
                icons.push(new ImageIcon(lat, lon, url, f.name, (lat,lon)=>{
                    mod_map.set(f, [lat, lon]);
                }));
            } else {
                alert(`${f.name} won't render because it is missing exif data`)
            }
        }
    }

    const source = new VectorSource({
        features: icons.map(i=>i.feature)
    })

    const layer = new VectorLayer({
        source: source
    })

    return {layer: layer, modifications: mod_map, icons: icons};
} 
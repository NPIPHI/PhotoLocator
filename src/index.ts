import Map from 'ol/Map';
import View from 'ol/View';
import { get_folder } from './file_handling';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import { DbfFeature, load_shapefiles } from './Shapefiles';
import { load_images, save_exif_data } from './Images';
import { Translate, defaults } from 'ol/interaction';
import { Fill, Text } from 'ol/style';


const images_button = <HTMLButtonElement>document.getElementById("images_button");
const shape_button = <HTMLButtonElement>document.getElementById("shape_button");
const save_button = <HTMLButtonElement>document.getElementById("save_button");
const toggle_button = <HTMLButtonElement>document.getElementById("toggle_button");
const prop_selector_table = <HTMLDivElement>document.getElementById("prop_selector_table");
const shape_selector_table = <HTMLDivElement>document.getElementById("shape_selector_table");

images_button.addEventListener('click', async ()=>{
    const files = await get_folder();

    const {layer, modifications, icons} = await load_images(files);
    save_button.addEventListener('click', ()=>{
        modifications.forEach(([lat, lon], file)=>{
            save_exif_data(file, lat, lon);
        })
        modifications.clear();
    })

    let are_icons = true;;

    toggle_button.addEventListener('click', ()=>{
        icons.forEach(icon=>{
            if(are_icons){
                icon.setStyleThumbnail();
            } else {
                icon.setStyleIcon();
            }
        })
        are_icons = !are_icons;
    })
    
    map.addLayer(layer);
});

function make_selector(prop: string, callback: (prop: string, checked: boolean)=>void): HTMLDivElement{
    const div = document.createElement("div");
    div.className = "display_selector";
    const text = document.createElement("div");
    text.innerText = prop;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.addEventListener('click', evt=>{
        callback(prop, input.checked);
    });
    input.id = `select_${prop}`;
    div.appendChild(input);
    div.appendChild(text);
    return div;
}

function set_array_element(arr: string[], prop: string, set: boolean){
    if(set){
        if(arr.indexOf(prop) == -1) arr.push(prop);
    } else {
        const idx = arr.indexOf(prop);
        if(idx != -1){
            arr.splice(idx, 1);
        }
    }
}

shape_button.addEventListener('click', async () => {
    const folder = await get_folder();
    const {shapefiles, props} = await load_shapefiles("sections", "EPSG:3857", folder);

    props.map(p=>make_selector(p, (prop, val)=>{
        set_array_element(selected_props, prop, val);
        layers.forEach(layer => layer.setStyle(style_function(selected_props)));
    })).forEach(checkbox=>{
        prop_selector_table.appendChild(checkbox);
    });

    const branch_id = <HTMLInputElement>document.getElementById("select_BRANCHID");
    const section_id = <HTMLInputElement>document.getElementById("select_SECTIONID");

    branch_id.checked = true;
    section_id.checked = true;

    let selected_props = ["BRANCHID", "SECTIONID"];
    let selected_layers = [];

    const center = shapefiles[0]?.features[0]?.getGeometry().getClosestPoint([0,0]) || [0,0];

    const layers = shapefiles.map(shape=>{
        const selector = make_selector(shape.name, (name, val)=>{layer.setVisible(val)});
        (selector.children[0] as HTMLInputElement).checked = true;

        shape_selector_table.appendChild(selector);
        const vector_source = new VectorSource({
            features: shape.features,
        })
        const layer = new VectorLayer({
            source: vector_source,
            style: style_function(selected_props),
        })

        return layer;
    });

    layers.forEach(layer => map.addLayer(layer));


    map.setView(new View({
        center: center,
        zoom: 10
    }))    
})

const styles = {
    'LineString': new Style({
        stroke: new Stroke({
            color: 'green',
            width: 1,
        })
    })
}

function text_style(text: string){
    return new Style({
        text:new Text({
            text: text,
            font: 'bold 15px Times New Roman',
            offsetY: 25,
            fill: new Fill({color: 'rgb(0,0,0)'}),
            stroke: new Stroke({color: 'rgb(255,255,255)', width: 1})
        })
    })
}

function style_function(name_selector: string[]): (feature: DbfFeature) => Style[] {
    return (feature: DbfFeature) => {
        let text = name_selector.map(name=>{
            const val = feature.dbf_properties[name];
            if(val === undefined || val === null){
                return `[MISSING ${name}]`;
            } else {
                return val;
            }
        }).join('-');
    

        if(text.length > 40){
            text = text.slice(0, 40) + "...";
        }
        if(text){
            return [styles.LineString, text_style(text)];
        } else {
            return [styles.LineString];
        }
    }
}


const translate = new Translate({
    filter: (feat, layer) => {
        return !(layer instanceof TileLayer) && feat.getGeometry().getType() == "Point";
    }
})
  
const map = new Map({
    interactions: defaults().extend([translate]),
    target: 'map',
    controls: [],
    layers: [
        new TileLayer({
            source: new OSM({attributions: null})
        })
    ],
    view: new View({
    center: [0, 0],
    zoom: 1
    })
});

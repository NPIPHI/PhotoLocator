import Map from 'ol/Map';
import View from 'ol/View';
import { get_folder } from './FileHandling';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import { DbfFeature, load_shapefiles, Shapefile } from './Shapefile';
import { ImageIcon, load_images, save_exif_data } from './Images';
import { Translate, defaults } from 'ol/interaction';
import { Fill, Text } from 'ol/style';
import VectorImageLayer from 'ol/layer/VectorImage';
import { ShapefileList } from './ui/ShapefileList';
import { SelectionElement } from './ui/SelectorArray';
import { PhotoList } from './ui/PhotoList';


const images_button = <HTMLButtonElement>document.getElementById("images_button");
const shape_button = <HTMLButtonElement>document.getElementById("shape_button");
const save_button = <HTMLButtonElement>document.getElementById("save_button");
const toggle_button = <HTMLButtonElement>document.getElementById("toggle_button");
const image_name_toggle_button = <HTMLButtonElement>document.getElementById("toggle_image_names");
const shape_selector_table = <HTMLDivElement>document.getElementById("shape_selector_table");
const image_table = <HTMLDivElement>document.getElementById("images_table");

var should_confirm_exit = false;
const shapefile_selector = new ShapefileList();
const image_list = new PhotoList();

shape_selector_table.appendChild(shapefile_selector);
image_table.appendChild(image_list);


export function set_confirm_exit(){
    should_confirm_exit = true;
    save_button.className = "unsaved";
}

export function unset_confirm_exit(){
    should_confirm_exit = false;
    save_button.className = "saved";
}

window.close = ()=>{
    if(should_confirm_exit){
        return "You have unsaved changes"
    }
}

window.onbeforeunload = ()=>{
    if(should_confirm_exit){
        return "You have unsaved changes"
    }
}

// Handle updates to the visible property list
shapefile_selector.addEventListener("shapefile-prop-update", (evt: CustomEvent)=>{
    update_visible_props(evt.detail.shapefile, evt.detail.new_props);
});

function update_visible_props(shape: Shapefile, props: SelectionElement[]){
    shape.set_visible_props(props.filter(p=>p.val).map(p=>p.prop));
}

// Handle updates to the visible shapefile list
shapefile_selector.addEventListener("shapefile-visible-update", (evt: CustomEvent)=>{
    set_layer_visible(evt.detail.shapefile, evt.detail.visible);
});

function set_layer_visible(shape: Shapefile, visible: boolean){
    shape.set_visible(visible);
}

shapefile_selector.addEventListener("focus-shapefile", (evt: CustomEvent)=>{
    const shp: Shapefile = evt.detail;

    map.setView(new View({
        center: shp.features[0].getGeometry().getClosestPoint([0,0]),
        zoom: 10
    }))
})

image_list.addEventListener("focus-image", (evt: CustomEvent)=>{
    const img: ImageIcon = evt.detail;
    map.setView(new View({
        center: img.feature.getGeometry().getClosestPoint([0,0]),
        zoom: map.getView().getZoom()
    }))
});

/**
 * When the user clicks the load image button, load the selected images onto the map
 */
images_button.addEventListener('click', async () => {
    const files = await get_folder();

    const { layer, modifications, icons } = await load_images(files, map.getView().getCenter());
    save_button.addEventListener('click', async () => {
        await Promise.all(Array.from(modifications.entries()).map(([file, [lat,lon]]) => save_exif_data(file, lat, lon)));
        alert(`${modifications.size} photo${modifications.size == 1 ? '' : 's'} saved`);
        modifications.clear();
        unset_confirm_exit();
    })

    image_list.add_images(icons);

    let are_thumbnail = false;
    let are_named = false;

    toggle_button.addEventListener('click', () => {
        are_thumbnail = !are_thumbnail;
        icons.forEach(icon => {
            icon.setStyle(are_named, are_thumbnail);
        })
    })

    image_name_toggle_button.addEventListener('click', () => {
        are_named = !are_named;
        icons.forEach(icon => {
            icon.setStyle(are_named, are_thumbnail);
        })
    })

    map.addLayer(layer);
});

/**
 * When the user clicks the load shape button, load the selected shapes onto the map
 */
shape_button.addEventListener('click', async () => {
    const folder = await get_folder();
    const shapefiles = await load_shapefiles("EPSG:3857", folder);

    shapefiles.forEach(s=>map.addLayer(s.layer));

    shapefiles.forEach(s=>shapefile_selector.add_shapefile(s));

    if(shapefiles.length > 0){
        map.setView(new View({
            center: shapefiles[0].features[0].getGeometry().getClosestPoint([0,0]),
            zoom: 10
        }))
    }
})

const LineStringStyle =
    new Style({
        stroke: new Stroke({
            color: 'green',
            width: 1,
        })
    });

function text_style(text: string) {
    return new Style({
        text: new Text({
            text: text,
            font: 'bold 15px Calibri',
            offsetY: 25,
            fill: new Fill({ color: 'rgb(0,0,255)' }),
            stroke: new Stroke({ color: 'rgb(255,255,255)', width: 1 })
        })
    })
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
            source: new OSM({ attributions: null })
        })
    ],
    view: new View({
        center: [0, 0],
        zoom: 1
    })
});

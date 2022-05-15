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
}

export function unset_confirm_exit(){
    should_confirm_exit = false;
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
 * Make a checkbox with a name
 * @param prop name to put next to checkbox
 * @param callback callback for when the checkbox is selected/deselected
 * @returns Div element containing checkbox and name
 */
function make_selector(prop: string, callback: (prop: string, checked: boolean) => void): HTMLDivElement {
    const div = document.createElement("div");
    div.className = "display_selector";
    const text = document.createElement("div");
    text.innerText = prop;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.addEventListener('click', evt => {
        callback(prop, input.checked);
    });
    input.id = `select_${prop}`;
    div.appendChild(input);
    div.appendChild(text);
    return div;
}

function set_array_element(arr: string[], prop: string, set: boolean) {
    if (set) {
        if (arr.indexOf(prop) == -1) arr.push(prop);
    } else {
        const idx = arr.indexOf(prop);
        if (idx != -1) {
            arr.splice(idx, 1);
        }
    }
}

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

    // props.map(p => make_selector(p, (prop, val) => {
    //     set_array_element(selected_props, prop, val);
    //     shapefiles.forEach(shape=>shape.features.forEach(f=>f.setStyle(style_function(f, selected_props))));
    // })).forEach(checkbox => {
    //     prop_selector_table.appendChild(checkbox);
    // });

    // const branch_id = <HTMLInputElement>document.getElementById("select_BRANCHID");
    // const section_id = <HTMLInputElement>document.getElementById("select_SECTIONID");

    // let selected_props: string[] = [];

    // if(branch_id) {
    //     branch_id.checked = true;
    //     selected_props.push("BRANCHID");
    // }

    // if(section_id) {
    //     section_id.checked = true;
    //     selected_props.push("SECTIONID");
    // }

    // const center = shapefiles[0]?.features[0]?.getGeometry().getClosestPoint([0, 0]) || [0, 0];

    // const layers = shapefiles.map(shape => {
    //     const selector = make_selector(shape.name, (name, val) => { layer.setVisible(val) });
    //     (selector.children[0] as HTMLInputElement).checked = true;


    //     shape.features.forEach(feature=>feature.setStyle(style_function(feature, selected_props)));

    //     shape_selector_table.appendChild(selector);
    //     const vector_source = new VectorSource({
    //         features: shape.features,
    //     })
    //     const layer = new VectorImageLayer({
    //         source: vector_source,
    //         // style: style_function(selected_props),
    //     })

    //     return layer;
    // });

    // layers.forEach(layer => map.addLayer(layer));
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

/**
 * Styles the shapefile with the correct properties displayed
 * @param name_selector which feature properties to display
 * @returns array of styles for the given feature
 */
function style_function(feature: DbfFeature, name_selector: string[]): Style[] {
    let text = name_selector.map(name => {
        const val = feature.dbf_properties[name];
        if (val === undefined || val === null) {
            return `[NO ${name}]`;
        } else {
            return val;
        }
    }).join('-');

    if (text.length > 40) {
        text = text.slice(0, 40) + "...";
    }
    if (text) {
        return [LineStringStyle, text_style(text)];
    } else {
        return [LineStringStyle];
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
            source: new OSM({ attributions: null })
        })
    ],
    view: new View({
        center: [0, 0],
        zoom: 1
    })
});

import Map from 'ol/Map';
import View from 'ol/View';
import { get_folder } from './file_handling';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import { load_shapefiles } from './Shapefiles';
import { load_images, save_exif_data } from './Images';
import { Translate, defaults } from 'ol/interaction';


const images_button = <HTMLButtonElement>document.getElementById("images_button");
const shape_button = <HTMLButtonElement>document.getElementById("shape_button");
const save_button = <HTMLButtonElement>document.getElementById("save_button");

images_button.addEventListener('click', async ()=>{
    const files = await get_folder();

    const {layers, modifications} = await load_images(files);
    save_button.addEventListener('click', ()=>{
        modifications.forEach(([lat, lon], file)=>{
            save_exif_data(file, lat, lon);
        })
        modifications.clear();
    })
    layers.forEach(layer=>{
        map.addLayer(layer)
    })
});

shape_button.addEventListener('click', async () => {
    const folder = await get_folder();
    const shapes = await load_shapefiles("sections", "EPSG:3857", folder);

    const center = shapes[0].getGeometry().getClosestPoint([0,0]);

    const vector_source = new VectorSource({
        features: shapes,
    })

    map.setView(new View({
        center: center,
        zoom: 10
    }))

    map.addLayer(
        new VectorLayer({
            source: vector_source,
            style: style_function,
        })
    )
})

const styles = {
    'LineString': new Style({
        stroke: new Stroke({
            color: 'green',
            width: 1,
        })
    })
}

function style_function(feature: any): Style {
    return styles.LineString;
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

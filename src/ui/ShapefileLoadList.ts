import { LitElement, html, CSSResultGroup, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import "./SelectorArray"
import { SelectionElement } from "./SelectorArray";


@customElement("shapefile-load-list")
export class ShapeFileLoadList extends LitElement {
    constructor(props: SelectionElement[]){
        super();
        this.names = props;
    }
    @property()
    names: SelectionElement[] = [];


    static styles = css`
        .outer {
            position: fixed;
            bottom: 25vh;
            right: 25vw;
            width: 50vw;
            height: 50vh;
            border: 2px solid black;
            background-color: lightblue;
        }

        #selector {
            height: 70%;
            overflow-y: auto;
        }

        div {
            margin: 10px;
            padding: 5px;
        }
    `

    private dispatch_load(){
        this.dispatchEvent(new CustomEvent("load-shapefiles", {detail: this.names}));
    }

    private dispatch_close(){
        this.dispatchEvent(new CustomEvent("exit"));
    }

    protected render(): unknown {
        return html`
        <div class="outer">
            <div>Select Which Shapefiles to load</div>
            <div id="selector">
                <selector-array .elements=${this.names}></selector-array>
            </div>
            <div>
                <button @click=${this.dispatch_load}>Load</button>
                <button @click=${this.dispatch_close}>Exit</button>
            </div>
        </div>
        `
    }
}
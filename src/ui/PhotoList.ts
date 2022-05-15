import { LitElement, html, CSSResultGroup, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { ImageIcon } from "../Images";

@customElement("photo-list")
export class PhotoList extends LitElement {

    static styles = css`
        .img-list {
            height: 50vh;
            overflow-y: auto;
            overflow-x: hidden;
        }
    `

    @query('#search')
    search_box: HTMLInputElement;

    @property()
    images: ImageIcon[] = [];

    add_images(images: ImageIcon[]){
        this.images = [...this.images, ...images];
    }

    focus_image(image: ImageIcon){
        console.log(image.image_name);
        this.dispatchEvent(new CustomEvent("focus-image", {detail: image}));
    }

    private search_update(){
        const search_str = this.search_box.value;
        this.images.sort(this.image_searcher(search_str));
        this.requestUpdate();
    }

    private match_score(name: string, query: string): number{
        if(query.length == 0) return 0;
        query = query.toLowerCase();
        name = name.toLowerCase();
        let score = 0;
        let query_idx = 0;
        let prev_match = true;

        for(let i = 0; i < name.length; i++){
            if(name[i] == query[query_idx]){
                score += 1;
                if(prev_match) score += 1;
                prev_match = true;
                query_idx++;
                if(query_idx >= query.length){
                    break;
                }
            } else {
                prev_match = false;
            }
        }

        return score;
    }

    private image_searcher(query: string): (a: ImageIcon, b: ImageIcon)=> number {
        return (a: ImageIcon, b: ImageIcon)=>this.match_score(b.image_name, query) - this.match_score(a.image_name, query);
    }

    protected render() {
        return html`
            Images<br>
            Serach:<input id="search" @input=${()=>this.search_update()} type="text">
            <div class="img-list">
            ${this.images.map(i=>
                html`
                    <div>
                        ${i.image_name}
                        <button @click=${()=>this.focus_image(i)}>Focus</button>
                    </div>
                    
                `)}
            </div>
        `
    }
}
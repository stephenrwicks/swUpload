class SwImageUpload extends HTMLElement {
    #input?: HTMLInputElement;
    #previewDiv?: HTMLDivElement;
    #imgContainers?: Array<HTMLDivElement>;
    static observedAttributes = ["maxuploads"];
    constructor() {
        super();
    }

    get files(): FileList {
        return this.#input!.files ?? new DataTransfer().files;
    }

    set files(fileList: FileList | Array<File>) {
        if (Array.isArray(fileList)) {
            const dataTransfer = new DataTransfer();
            for (const file of fileList) dataTransfer.items.add(file);
            this.#input!.files = dataTransfer.files;
            this.#input?.dispatchEvent(new Event('change'));
        }
        else if (fileList instanceof FileList) {
            this.#input!.files = fileList;
            this.#input?.dispatchEvent(new Event('change'));
        }
        else {
            throw new Error('Must be FileList or Array<File>');
        }
    }

    get fileNames() {
        return Array.from(this.files).map(file => file.name);
    }

    get maxUploads(): number | null {
        const n = Number(this.getAttribute('maxuploads')?.trim());
        if (n === null || 0) return null;
        if (isNaN(n)) return null;
        return n;
    }

    set maxUploads(n: number) {
        n = Number(n);
        if (n === 0 || isNaN(n)) this.setAttribute('maxuploads', '');
        this.setAttribute('maxuploads', `${n}`);
        if (this.maxUploads && this.files.length > this.maxUploads) {
            this.files = Array.from(this.files).slice(0, this.maxUploads);
        }
    }

    connectedCallback(): void {
        this.attachShadow({ mode: 'open' });
        this.#input = document.createElement('input');
        this.#input.type = 'file';
        this.#input.accept = 'image/*';
        this.#input.multiple = true;
        this.#previewDiv = document.createElement('div');
        this.#previewDiv.classList.add('preview-div');
        this.#previewDiv.tabIndex = 0;
        const style = document.createElement('style');
        style.textContent = ` 
        :host {
            display: block;
            width: fit-content;
            margin-bottom: 1rem;
        }
        input {
            display: block;
        }
        .preview-div {
            display: flex;
            flex-flow: row wrap;
            gap: 1.5rem;
            padding: .5rem 0px 1rem 0px;
            height: fit-content;
            min-width: 30rem;
        }
        .preview-div:empty {
            padding: 0px;
            min-height: 0px;
            min-width: 0px;
        }
        .img-container {
            display: grid;
            position: relative;
            overflow: hidden;
            height: 5rem;
            width: 5rem;
            border: 1px solid transparent;
            cursor: pointer;
            box-shadow: 1px 1px 3px 3px #ddd;
        }
        .img-container:focus {
            border-color: blue;
            outline: 0px;
        }
        .img-container img {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 100%;
            height: auto;
            object-fit: cover;
            user-select: none;
        }
        .clear-button {
            display: block;
        }
        .preview-div:empty + .clear-button {
            display: none;
        }
        dialog {
            height: fit-content;
            width: fit-content;
            max-height: 75vh;
            max-width: 60vw;
            border: 0px;
            outline: 0px;
            box-shadow: 0px 0px 5px 5px #ddd;
            padding: 15px;
        }

        dialog img {
            width: 100%;
            height: auto;
        }

        ::backdrop {
            background-color: black;
            opacity: .6;
        }
        `;

        let oldValue: FileList;
        this.#input.addEventListener('click', () => oldValue = this.files);
        this.#input.addEventListener('focus', () => oldValue = this.files);
        this.#input.addEventListener('keydown', () => oldValue = this.files);
        this.#input.addEventListener('change', (e) => {
            if (this.maxUploads && this.files.length > this.maxUploads) {
                this.files = oldValue;
                e.preventDefault();
                alert(`You can only upload up to ${this.maxUploads} files.`);
                return;
            }
            if (!Array.from(this.files).every(file => file.type.startsWith('image'))) {
                this.files = oldValue;
                e.preventDefault();
                alert(`You can only upload image files.`);
                return;
            }
            this.renderPreviewDiv();
        });
        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.textContent = 'Clear';
        clearButton.classList.add('clear-button');
        clearButton.addEventListener('click', () => this.clear());
        this.shadowRoot!.append(style, this.#input, this.#previewDiv, clearButton);
    }

    renderPreviewDiv() {
        this.#previewDiv!.innerHTML = '';
        this.#imgContainers = Array.from(this.#input!.files || []).map((file, i) => this.buildImgContainer(file, i));
        this.#previewDiv!.append(...this.#imgContainers);
    }

    buildImgContainer(file: File, index: number): HTMLDivElement {
        const reader = new FileReader();
        const div = document.createElement('div');
        const img = document.createElement('img');
        img.title = file.name ?? '';
        img.alt = 'Image upload preview';
        reader.addEventListener('load', (e) => img.src = e.target!.result as string, { once: true });
        reader.readAsDataURL(file);
        div.tabIndex = 0;
        div.classList.add('img-container');
        div.append(img);
        div.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                div.remove();
                this.removeFile(index);
                if (this.#imgContainers) this.#imgContainers[e.key === 'Backspace' ? (index - 1) : index]?.focus();
            }
        });
        div.addEventListener('dblclick', () => {
            const dialog = document.createElement('dialog');
            dialog.append(img.cloneNode(true));
            dialog.addEventListener('click', (e) => {
                const rect = dialog.getBoundingClientRect();
                if (!(rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                    rect.left <= e.clientX && e.clientX <= rect.left + rect.width)) {
                    dialog.remove();
                }
            });
            dialog.addEventListener('cancel', () => dialog.remove());
            this.shadowRoot!.append(dialog);
            dialog.showModal();
        });
        return div;
    }

    removeFile(index: number) {
        const fileArray = Array.from(this.files);
        fileArray.splice(index, 1);
        this.files = fileArray;
    }

    clear() {
        this.files = [];
    }

    attributeChangedCallback(name: string) {
        if (name === 'maxuploads') {
            if (!this.#input) return;
            if (this.maxUploads && this.files.length > this.maxUploads) {
                this.files = Array.from(this.files).slice(0, this.maxUploads);
            }
        }
    }
}
customElements.define('sw-image-upload', SwImageUpload);

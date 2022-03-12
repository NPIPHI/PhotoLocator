export async function get_folder(): Promise<FileSystemFileHandle[]> {
    let ret: FileSystemFileHandle[] = [];
    
    const folder = await window.showDirectoryPicker({});
    let it = folder.entries();
    while(true){
        let maybe_file = await it.next();
        if(maybe_file.done) break;

        const file : FileSystemFileHandle | FileSystemDirectoryHandle = maybe_file.value[1];

        if(file instanceof FileSystemFileHandle){
            ret.push(file);
        }
    }

    return ret;
}

export async function get_file(): Promise<FileSystemFileHandle> {
    const files = await window.showOpenFilePicker({multiple: false});
    return files[0];
}


export function extension_of(file: FileSystemFileHandle): string {
    const parts = file.name.split('.');
    return parts[parts.length - 1];
}


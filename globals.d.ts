import * as React from "react";

declare global {
    namespace JSX {
        interface IntrinsicElements {
            [elem: string]: any;
        }
    }
}

// Permet useRef<any>() partout sans erreur
declare module "react" {
    interface RefObject<T> {
        current: T | null;
    }
}
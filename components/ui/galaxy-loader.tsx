"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import StarField from "@/components/ui/star-field";

const GalaxyScene = dynamic(() => import("@/components/ui/galaxy-scene"), { ssr: false });

/** WebGL galaxy, with the light 2D starfield as fallback when WebGL is unavailable. */
export default function GalaxyLoader() {
    const [failed, setFailed] = useState(false);
    const onFail = useCallback(() => setFailed(true), []);
    return failed ? <StarField /> : <GalaxyScene onFail={onFail} />;
}

import { createContext, useContext } from "react";
import type { OrbixLoadingContextValue } from "./loader.types";

export const OrbixLoadingContext = createContext<OrbixLoadingContextValue | null>(null);

export const useGlobalLoader = (): OrbixLoadingContextValue => {
    const context = useContext(OrbixLoadingContext);
    if (!context) {
        throw new Error("useGlobalLoader must be used within an OrbixLoadingProvider");
    }
    return context;
};

"use client";
import { createContext } from "react";
/** Presentation-only context also reaches portals; no permissions or routing state. */
export const AdminAppearanceContext = createContext(false);

import type { BrandTokens, PresentationTemplate } from "../templateRegistry";
import { parsePresentationTemplateConfig, type PresentationTemplateConfig } from "../presentationTemplates/presentationTemplate";
export const SHARED_DESIGN_VERSION = 1 as const;
export const SHARED_DESIGN_SURFACES = ["QUIZ_QUESTION", "QUIZ_SOLUTION", "BINGO_NUMBER", "BINGO_PHRASE", "KARAOKE_TITLE", "KARAOKE_CONTENT"] as const;
export type SharedDesign = { version: 1; templateId: string; name: string; config: PresentationTemplateConfig };
export function sharedDesignTokens(template: Pick<PresentationTemplate,"tokens">): BrandTokens { return template.tokens; }
export function supportsSharedDesign(config: PresentationTemplateConfig) { return ["EDITORIAL","CORPORATE"].includes(config.design.stylePreset) && config.design.storybook === null; }
export function parseSharedDesign(value: unknown): SharedDesign | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r=value as Record<string,unknown>;
  if (Object.keys(r).sort().join(',') !== 'config,name,templateId,version' || r.version!==1 || typeof r.templateId!=="string" || !/^[a-z0-9-]{1,64}$/.test(r.templateId) || typeof r.name!=="string" || !r.name.trim() || r.name.length>200) return null;
  const config=parsePresentationTemplateConfig(r.config);
  return config && supportsSharedDesign(config) ? {version:1,templateId:r.templateId,name:r.name,config} : null;
}
export function parseDesignSelection(value: unknown, quiz=false): string | null {
  if(value===null || value==='')return null;
  if(quiz && value==='INHERIT')return value;
  if(typeof value!=="string" || !/^[a-z0-9-]{1,64}$/.test(value))throw new Error('Ungültige Designauswahl.');
  return value;
}


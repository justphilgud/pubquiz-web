export const LOVD_PRESENTATION_TEMPLATE_ID = "lovd-ungegoogelt";

// Original references from quiz #31 (Oktober, 21.10.2026). No media is copied.
const lovdIntroMedia = {
  intro_video_url: "https://bix6h2j23vjzi240.public.blob.vercel-storage.com/prod/media/video/intro/587ad80f-926f-49a3-b412-b663ea3fcd3a-gudi_lovd_philgud_v5_16x9_1920x1080-HYOhVLQCuzRYD2bKTEyu2OcygZlv7j.mp4",
  intro_musik_url: "https://bix6h2j23vjzi240.public.blob.vercel-storage.com/prod/media/audio/intro/2820758f-a93c-46fc-87cf-dd4dbb284b40-02-mexico-remastered--Iv5lNjcnhYApqggpXwQg1MRslvJRMI.mp3",
};

type IntroMedia = { intro_video_url: string | null; intro_musik_url: string | null };

export function newQuizIntroMedia(
  series: { slug: string; default_presentation_template_id: string | null },
  presentationTemplateId: string | null = null,
) {
  return series.slug === "lovd" ||
    (presentationTemplateId ?? series.default_presentation_template_id) === LOVD_PRESENTATION_TEMPLATE_ID
    ? lovdIntroMedia
    : {};
}

// Called only when a different presentation selection is saved. An empty
// string records an explicit removal; null is the only unconfigured state.
export function selectedQuizIntroMedia(templateId: string | null, current: IntroMedia) {
  if (templateId !== LOVD_PRESENTATION_TEMPLATE_ID) return {};
  return {
    ...(current.intro_video_url === null ? { intro_video_url: lovdIntroMedia.intro_video_url } : {}),
    ...(current.intro_musik_url === null ? { intro_musik_url: lovdIntroMedia.intro_musik_url } : {}),
  };
}

export function getQuizIntroAudioUrl(storedUrl: string | null) {
  return storedUrl === null ? "/medien/audio/intro/mexico.mp3" : storedUrl.trim() || null;
}

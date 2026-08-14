import { getMediaUploadEnvironmentPrefix } from "@/app/fragen/editor/mediaUploadEnvironment";
import type { SlideMediaUploadSlot } from "@/app/quiz/slideMediaUpload";
import BlobUploadFieldClient from "./BlobUploadFieldClient";

type BlobUploadFieldProps = {
  label: string;
  quizId: number;
  hiddenFieldName: string;
  currentUrl?: string | null;
  slot: SlideMediaUploadSlot;
  accept: string;
};

export default function BlobUploadField(props: BlobUploadFieldProps) {
  return (
    <BlobUploadFieldClient
      {...props}
      environmentPrefix={getMediaUploadEnvironmentPrefix()}
    />
  );
}

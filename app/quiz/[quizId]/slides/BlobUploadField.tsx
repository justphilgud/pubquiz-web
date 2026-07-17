import { getMediaUploadEnvironmentPrefix } from "@/app/fragen/editor/mediaUploadEnvironment";
import BlobUploadFieldClient from "./BlobUploadFieldClient";

type BlobUploadFieldProps = {
  label: string;
  hiddenFieldName: string;
  currentUrl?: string | null;
  zielordner: string;
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

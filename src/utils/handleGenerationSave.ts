import { createWorkReq, getWorksByIdReq, updateWorkVersionReq } from "@/api/works";
import { useEditorStore } from "@/stores/editorStore";
import { showGenerationSaveDialog } from "@/utils/showGenerationSaveDialog";

const stripPrefixBeforeSlash = (input: string): string => {
  const index = input.indexOf("/");
  return index === -1 ? input : input.slice(index + 1);
};

export const handleGenerationSave = async (
  fileName: string,
  saveContent: string,
  currentWorkId?: string
): Promise<string | false> => {
  try {
    const result = await showGenerationSaveDialog({
      fileNameDefault: fileName,
      currentWorkId,
    });

    if (!result.selectedPath) {
      return false;
    }

    let saveId = "";
    const savePath = `${stripPrefixBeforeSlash(result.selectedPath)}/${result.fileName}.md`;

    if (result.workType === "new") {
      const createNewWorkReq: any = await createWorkReq();
      const newWorkId = String(createNewWorkReq?.id ?? "");
      if (!newWorkId) return false;

      const newWorkFiles = JSON.parse(createNewWorkReq?.latestWorkVersion?.content || "{}");
      const saveFiles = {
        ...newWorkFiles,
        [savePath]: saveContent,
      };
      await updateWorkVersionReq(newWorkId, JSON.stringify(saveFiles), "0");
      saveId = newWorkId;
    } else {
      const workId = String(result.selectedWork?.id ?? "");
      if (!workId) return false;

      if (currentWorkId && currentWorkId === workId) {
        await useEditorStore.getState().saveEditorData("1");
      }

      const work: any = await getWorksByIdReq(workId);
      const workFiles = JSON.parse(work?.latestWorkVersion?.content || "{}");
      const saveFiles = {
        ...workFiles,
        [savePath]: saveContent,
      };
      await updateWorkVersionReq(workId, JSON.stringify(saveFiles), "0");
      saveId = workId;
    }

    return saveId || false;
  } catch (error) {
    if ((error as Error)?.message === "用户取消") {
      return false;
    }
    throw error;
  }
};

export interface UploadFileResponse {
  fileName: string
  putFilePath: string
  uploadResult: Response
}

export interface UploadFile {
  name: string
  size?: number
  raw?: File
  uid?: number
  status?: string
  response?: UploadFileResponse
}

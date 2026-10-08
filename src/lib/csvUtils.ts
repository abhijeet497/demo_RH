import Papa from 'papaparse'

export const csvTimestamp = () =>
  new Date().toISOString().replace(/[-:]/g, '').split('.')[0]

/** Trigger a browser download of a Blob under `filename` via a synthetic
 * <a download> (object URL created then revoked). */
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.URL.revokeObjectURL(url)
}

export const downloadCsv = (data: any[], filename: string) => {
  const csv = Papa.unparse(data)
  downloadBlob(new Blob([csv], { type: 'text/csv' }), filename)
}

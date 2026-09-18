let configuration;
export function getDeployment() {
  return configuration ||= fetch('/api/deployment').then(async response => {
    if (!response.ok) throw new Error('Không kiểm tra được giới hạn tải lên. Hãy thử lại.');
    return response.json();
  }).catch(error => { configuration = undefined; throw error; });
}
export async function checkUpload(body) {
  if (!(body instanceof FormData)) return;
  const {uploadLimit} = await getDeployment();
  if (!uploadLimit) return;
  // Include the actual multipart envelope, not only file sizes.
  const bytes = (await new Response(body).blob()).size;
  if (bytes > uploadLimit) throw new Error('Bản Vercel nhận tối đa 4 MB mỗi lần tải lên. Hãy chọn tệp nhỏ hơn; bản lưu lớn có thể xuất về máy.');
}

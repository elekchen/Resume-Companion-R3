document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resumeForm');
    const resultDiv = document.getElementById('result');
    const fileInput = document.getElementById('resumeFile');
    const textArea = document.getElementById('resumeContent');
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.display = 'none';
    form.appendChild(progressBar);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        
        if (fileInput.files.length > 0) {
            formData.append('resumeFile', fileInput.files[0]);
        } else if (textArea.value.trim() !== '') {
            formData.append('resumeContent', textArea.value);
        } else {
            resultDiv.textContent = '请输入简历信息或上传文件。';
            return;
        }

        try {
            progressBar.style.display = 'block';
            progressBar.style.width = '0%';
            resultDiv.textContent = '正在生成简历...';

            updateProgress(); // 调���进度更新函数

            const response = await fetch('/generate-resume', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                if (data.downloadUrl) {
                    resultDiv.innerHTML = `<p>简历生成成功！<a href="${data.downloadUrl}" target="_blank">点击下载</a></p>`;
                } else {
                    resultDiv.textContent = '生成简历时出错：未收到下载链接';
                }
            } else {
                const errorData = await response.json();
                resultDiv.textContent = `生成简历时出错：${errorData.error || '未知错误'}`;
            }
        } catch (error) {
            console.error('Error:', error);
            resultDiv.textContent = `发生错误：${error.message || '未知错误'}`;
        } finally {
            progressBar.style.display = 'none';
        }
    });

    // 模拟进度更新（因为我们没有实时进度信息）
    function updateProgress() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            if (progress > 90) {
                clearInterval(interval);
            } else {
                progressBar.style.width = `${progress}%`;
            }
        }, 500);
    }
});
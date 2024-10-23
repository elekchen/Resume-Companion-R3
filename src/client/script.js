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
            resultDiv.textContent = 'Please enter resume information or upload a file.';
            return;
        }

        try {
            progressBar.style.display = 'block';
            progressBar.style.width = '0%';
            resultDiv.textContent = 'Generating resume...';

            updateProgress(); // Call the progress update function

            const response = await fetch('/generate-resume', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                if (data.downloadUrl) {
                    resultDiv.innerHTML = `<p>Resume generated successfully! <a href="${data.downloadUrl}" target="_blank">Click to download</a></p>`;
                } else {
                    resultDiv.textContent = 'Error generating resume: No download link received';
                }
            } else {
                const errorData = await response.json();
                resultDiv.textContent = `Error generating resume: ${errorData.error || 'Unknown error'}`;
            }
        } catch (error) {
            console.error('Error:', error);
            resultDiv.textContent = `An error occurred: ${error.message || 'Unknown error'}`;
        } finally {
            progressBar.style.display = 'none';
        }
    });

    // Simulate progress update (since we don't have real-time progress information)
    function updateProgress() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5; // Reduce the progress increment
            if (progress > 95) {
                clearInterval(interval);
            } else {
                progressBar.style.width = `${progress}%`;
            }
        }, 1000); // Increase update interval to 1 second
    }
});

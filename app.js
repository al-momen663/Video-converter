document.addEventListener('DOMContentLoaded', () => {
    const { createFFmpeg, fetchFile } = FFmpeg;
    const ffmpeg = createFFmpeg({ 
        log: true,
        progress: ({ ratio }) => {
            const percent = Math.round(ratio * 100);
            progressText.textContent = `${percent}%`;
            progressBar.value = percent;
        }
    });
    
    // DOM elements
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const fileBtn = document.getElementById('file-btn');
    const convertBtn = document.getElementById('convert-btn');
    const formatOptions = document.getElementById('format-options');
    const qualitySelect = document.getElementById('quality-select');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const outputDiv = document.getElementById('output');
    const fileInfoDiv = document.getElementById('file-info');
    
    let inputFile = null;
    let selectedFormat = 'mp4';
    
    // Initialize format selection
    formatOptions.querySelectorAll('.format-option').forEach(option => {
        option.addEventListener('click', () => {
            formatOptions.querySelectorAll('.format-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');
            selectedFormat = option.dataset.format;
        });
    });
    
    // Set MP4 as default selected
    formatOptions.querySelector('.format-option[data-format="mp4"]').classList.add('selected');
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('highlight');
    }
    
    function unhighlight() {
        dropArea.classList.remove('highlight');
    }
    
    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }
    
    // Handle selected files
    fileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    
    function handleFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|mov|avi|mkv|flv|wmv|gif)$/i)) {
            alert('Please select a video file');
            return;
        }
        
        inputFile = file;
        convertBtn.disabled = false;
        
        // Display file info
        fileInfoDiv.innerHTML = `
            <p>Selected file: <strong>${file.name}</strong></p>
            <p>Size: ${formatBytes(file.size)} | Type: ${file.type || 'unknown'}</p>
        `;
        
        // Create video preview
        const videoUrl = URL.createObjectURL(file);
        fileInfoDiv.innerHTML += `
            <p>Preview:</p>
            <video controls style="max-width: 100%; max-height: 200px;">
                <source src="${videoUrl}" type="${file.type}">
                Your browser does not support the video tag.
            </video>
        `;
    }
    
    // Convert button click handler
    convertBtn.addEventListener('click', convertVideo);
    
    async function convertVideo() {
        if (!inputFile) return;
        
        const inputName = inputFile.name;
        const outputName = inputName.replace(/\.[^/.]+$/, '') + '.' + selectedFormat;
        const quality = qualitySelect.value;
        
        // Show progress
        progressContainer.style.display = 'block';
        progressBar.value = 0;
        progressText.textContent = '0%';
        convertBtn.disabled = true;
        outputDiv.innerHTML = '<p>Starting conversion...</p>';
        
        try {
            // Load FFmpeg if not already loaded
            if (!ffmpeg.isLoaded()) {
                outputDiv.innerHTML += '<p>Loading FFmpeg...</p>';
                await ffmpeg.load();
            }
            
            // Write the file to FFmpeg's file system
            ffmpeg.FS('writeFile', inputName, await fetchFile(inputFile));
            
            // Prepare FFmpeg command based on output format and quality
            let command = ['-i', inputName];
            
            // Common options
            command.push('-y'); // Overwrite output files without asking
            
            // Add format-specific options
            switch(selectedFormat) {
                case 'mp4':
                    command.push('-c:v', 'libx264');
                    command.push('-c:a', 'aac');
                    command.push('-strict', 'experimental');
                    command.push('-movflags', '+faststart');
                    break;
                    
                case 'webm':
                    command.push('-c:v', 'libvpx-vp9');
                    command.push('-c:a', 'libopus');
                    command.push('-b:v', '1M');
                    command.push('-row-mt', '1');
                    break;
                    
                case 'mov':
                    command.push('-c:v', 'mpeg4');
                    command.push('-c:a', 'aac');
                    command.push('-strict', 'experimental');
                    command.push('-q:v', '3');
                    break;
                    
                case 'avi':
                    command.push('-c:v', 'libxvid');
                    command.push('-c:a', 'libmp3lame');
                    command.push('-qscale:v', '3');
                    break;
                    
                case 'mkv':
                    command.push('-c:v', 'libx264');
                    command.push('-c:a', 'aac');
                    command.push('-strict', 'experimental');
                    break;
                    
                case 'flv':
                    command.push('-c:v', 'flv');
                    command.push('-c:a', 'mp3');
                    command.push('-ar', '44100');
                    break;
                    
                case 'wmv':
                    command.push('-c:v', 'wmv2');
                    command.push('-c:a', 'wmav2');
                    break;
                    
                case 'gif':
                    command.push('-vf', 'fps=15,scale=640:-1:flags=lanczos');
                    command.push('-f', 'gif');
                    break;
            }
            
            // Apply quality settings
            if (selectedFormat !== 'gif') {
                switch(quality) {
                    case 'high':
                        command.push('-crf', '18');
                        command.push('-preset', 'slow');
                        break;
                    case 'medium':
                        command.push('-crf', '23');
                        command.push('-preset', 'medium');
                        break;
                    case 'low':
                        command.push('-crf', '28');
                        command.push('-preset', 'fast');
                        break;
                }
            }
            
            command.push(outputName);
            
            // Run FFmpeg command
            await ffmpeg.run(...command);
            
            // Read the result
            const data = ffmpeg.FS('readFile', outputName);
            
            // Create a download link
            const mimeType = getMimeType(selectedFormat);
            const blob = new Blob([data.buffer], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = outputName;
            a.textContent = `Download ${outputName}`;
            a.style.display = 'block';
            a.style.margin = '10px 0';
            
            // Display the result
            outputDiv.innerHTML = `
                <p>Conversion complete!</p>
                <p>Output file: <strong>${outputName}</strong> (${formatBytes(blob.size)})</p>
                <p>Click to download: </p>
            `;
            outputDiv.appendChild(a);
            
            // Create preview based on output type
            if (selectedFormat === 'gif') {
                const img = document.createElement('img');
                img.src = url;
                img.style.maxWidth = '100%';
                outputDiv.appendChild(img);
            } else {
                const video = document.createElement('video');
                video.controls = true;
                video.src = url;
                video.style.maxWidth = '100%';
                outputDiv.appendChild(video);
            }
            
        } catch (error) {
            console.error(error);
            outputDiv.innerHTML = `<p style="color: red;">Error during conversion: ${error.message}</p>`;
        } finally {
            convertBtn.disabled = false;
            progressContainer.style.display = 'none';
        }
    }
    
    // Helper function to get MIME type for format
    function getMimeType(format) {
        const mimeTypes = {
            mp4: 'video/mp4',
            webm: 'video/webm',
            mov: 'video/quicktime',
            avi: 'video/x-msvideo',
            mkv: 'video/x-matroska',
            flv: 'video/x-flv',
            wmv: 'video/x-ms-wmv',
            gif: 'image/gif'
        };
        return mimeTypes[format] || 'application/octet-stream';
    }
    
    // Helper function to format file sizes
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
});
const { createFFmpeg } = FFmpeg;
const ffmpeg = createFFmpeg({
  log: true,
  corePath: 'https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js',
  mainOptions: ['-pthreads', '1'] // Single-threaded mode
});
"use strict";
(function () {
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    const widthInput = document.getElementById('width');
    const heightInput = document.getElementById('height');
    const lockBtn = document.getElementById('lock-ratio');
    const formatSelect = document.getElementById('format');
    const qualityInput = document.getElementById('quality');
    const qualityValue = document.getElementById('quality-value');
    const outputDims = document.getElementById('output-dims');
    const outputSize = document.getElementById('output-size');
    const downloadBtn = document.getElementById('download');
    let originalFile = null;
    let originalImage = null;
    let aspectRatio = 1;
    let lockRatio = true;
    let resizedBlob = null;
    let currentPreviewUrl = null;
    let resizeTimeout = null;
    function formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    function getExtension(mime) {
        if (mime === 'image/jpeg')
            return 'jpg';
        if (mime === 'image/png')
            return 'png';
        if (mime === 'image/webp')
            return 'webp';
        return 'png';
    }
    function getOutputMimeType() {
        const fmt = formatSelect.value;
        if (fmt !== 'original')
            return fmt;
        const type = (originalFile === null || originalFile === void 0 ? void 0 : originalFile.type) || '';
        if (['image/jpeg', 'image/png', 'image/webp'].indexOf(type) !== -1)
            return type;
        return 'image/png';
    }
    function updateQualityUI() {
        const mime = getOutputMimeType();
        qualityInput.disabled = mime === 'image/png';
        qualityValue.textContent = Math.round(parseFloat(qualityInput.value) * 100) + '%';
    }
    function updateLockUI() {
        lockBtn.textContent = lockRatio ? 'Locked' : 'Unlocked';
        lockBtn.classList.toggle('locked', lockRatio);
    }
    function scheduleResize() {
        if (resizeTimeout)
            window.clearTimeout(resizeTimeout);
        resizeTimeout = window.setTimeout(() => {
            resize();
            resizeTimeout = null;
        }, 120);
    }
    function loadFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            var _a;
            const dataUrl = (_a = e.target) === null || _a === void 0 ? void 0 : _a.result;
            const img = new Image();
            img.onload = () => {
                originalFile = file;
                originalImage = img;
                aspectRatio = img.width / img.height;
                if (currentPreviewUrl)
                    URL.revokeObjectURL(currentPreviewUrl);
                currentPreviewUrl = null;
                preview.src = dataUrl;
                widthInput.value = String(img.width);
                heightInput.value = String(img.height);
                editor.classList.remove('hidden');
                updateQualityUI();
                updateLockUI();
                scheduleResize();
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    }
    function handleFile(file) {
        if (file && file.type.startsWith('image/')) {
            loadFile(file);
        }
    }
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        var _a;
        const target = e.target;
        handleFile((_a = target.files) === null || _a === void 0 ? void 0 : _a[0]);
    });
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
        var _a;
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFile((_a = e.dataTransfer) === null || _a === void 0 ? void 0 : _a.files[0]);
    });
    lockBtn.addEventListener('click', () => {
        lockRatio = !lockRatio;
        if (lockRatio && originalImage) {
            const w = parseInt(widthInput.value, 10) || originalImage.width;
            const h = Math.round(w / aspectRatio);
            heightInput.value = String(h);
        }
        updateLockUI();
        scheduleResize();
    });
    function onWidthChange() {
        if (!originalImage)
            return;
        const w = parseInt(widthInput.value, 10) || 1;
        if (lockRatio) {
            const h = Math.round(w / aspectRatio);
            heightInput.value = String(h);
        }
        scheduleResize();
    }
    function onHeightChange() {
        if (!originalImage)
            return;
        const h = parseInt(heightInput.value, 10) || 1;
        if (lockRatio) {
            const w = Math.round(h * aspectRatio);
            widthInput.value = String(w);
        }
        scheduleResize();
    }
    widthInput.addEventListener('input', onWidthChange);
    heightInput.addEventListener('input', onHeightChange);
    formatSelect.addEventListener('change', () => {
        updateQualityUI();
        scheduleResize();
    });
    qualityInput.addEventListener('input', () => {
        qualityValue.textContent = Math.round(parseFloat(qualityInput.value) * 100) + '%';
        scheduleResize();
    });
    function resize() {
        if (!originalImage)
            return;
        const w = parseInt(widthInput.value, 10) || 1;
        const h = parseInt(heightInput.value, 10) || 1;
        const mime = getOutputMimeType();
        const quality = parseFloat(qualityInput.value);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (mime === 'image/jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(originalImage, 0, 0, w, h);
        const qualityArg = mime === 'image/png' ? undefined : quality;
        canvas.toBlob((blob) => {
            if (!blob)
                return;
            resizedBlob = blob;
            outputDims.textContent = `${w} × ${h}`;
            outputSize.textContent = formatBytes(blob.size);
            const url = URL.createObjectURL(blob);
            if (currentPreviewUrl) {
                URL.revokeObjectURL(currentPreviewUrl);
            }
            currentPreviewUrl = url;
            preview.src = url;
        }, mime, qualityArg);
    }
    downloadBtn.addEventListener('click', () => {
        if (!resizedBlob || !originalFile)
            return;
        const url = URL.createObjectURL(resizedBlob);
        const a = document.createElement('a');
        a.href = url;
        const mime = getOutputMimeType();
        const ext = getExtension(mime);
        const baseName = originalFile.name.replace(/\.[^/.]+$/, '');
        a.download = `${baseName}-resized.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
    });
    updateLockUI();
    updateQualityUI();
})();

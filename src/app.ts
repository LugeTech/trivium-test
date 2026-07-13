(function () {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone') as HTMLElement;
  const editor = document.getElementById('editor') as HTMLElement;
  const preview = document.getElementById('preview') as HTMLImageElement;
  const widthInput = document.getElementById('width') as HTMLInputElement;
  const heightInput = document.getElementById('height') as HTMLInputElement;
  const lockBtn = document.getElementById('lock-ratio') as HTMLButtonElement;
  const formatSelect = document.getElementById('format') as HTMLSelectElement;
  const qualityInput = document.getElementById('quality') as HTMLInputElement;
  const qualityValue = document.getElementById('quality-value') as HTMLElement;
  const outputDims = document.getElementById('output-dims') as HTMLElement;
  const outputSize = document.getElementById('output-size') as HTMLElement;
  const downloadBtn = document.getElementById('download') as HTMLButtonElement;

  let originalFile: File | null = null;
  let originalImage: HTMLImageElement | null = null;
  let aspectRatio = 1;
  let lockRatio = true;
  let resizedBlob: Blob | null = null;
  let currentPreviewUrl: string | null = null;
  let resizeTimeout: number | null = null;
  let dragCounter = 0;

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function getExtension(mime: string): string {
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'png';
  }

  function getOutputMimeType(): string {
    const fmt = formatSelect.value;
    if (fmt !== 'original') return fmt;
    const type = originalFile?.type || '';
    if (['image/jpeg', 'image/png', 'image/webp'].indexOf(type) !== -1) return type;
    return 'image/png';
  }

  function updateQualityUI(): void {
    const mime = getOutputMimeType();
    qualityInput.disabled = mime === 'image/png';
    qualityValue.textContent = Math.round(parseFloat(qualityInput.value) * 100) + '%';
  }

  function updateLockUI(): void {
    lockBtn.textContent = lockRatio ? 'Locked' : 'Unlocked';
    lockBtn.classList.toggle('locked', lockRatio);
  }

  function scheduleResize(): void {
    if (resizeTimeout) window.clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(() => {
      resize();
      resizeTimeout = null;
    }, 120);
  }

  function loadFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        originalFile = file;
        originalImage = img;
        aspectRatio = img.width / img.height;

        if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
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

  function handleFile(file: File | undefined | null): void {
    if (file && file.type.startsWith('image/')) {
      loadFile(file);
    }
  }

  dropZone.addEventListener('click', (e) => {
    // Prevent triggering file input when clicking on child elements that are interactive
    // or when the editor is already visible (user might be clicking on controls)
    if (editor.classList.contains('hidden')) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    handleFile(target.files?.[0]);
  });

  dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      dropZone.classList.remove('drag-over');
    }
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    dropZone.classList.remove('drag-over');

    const dt = e.dataTransfer;
    if (!dt) return;

    // First try to get files directly
    if (dt.files && dt.files.length > 0) {
      handleFile(dt.files[0]);
      return;
    }

    // If no files, check items for URL data (dragged from another tab/website)
    if (dt.items && dt.items.length > 0) {
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            handleFile(file);
            return;
          }
        } else if (item.kind === 'string' && (item.type === 'text/uri-list' || item.type === 'text/plain')) {
          item.getAsString((uri) => {
            // Check if the URI looks like an image URL
            if (uri && (uri.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i) || uri.startsWith('data:image/'))) {
              fetchAndLoadImage(uri);
            }
          });
          return;
        }
      }
    }
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

  function onWidthChange(): void {
    if (!originalImage) return;
    const w = parseInt(widthInput.value, 10) || 1;
    if (lockRatio) {
      const h = Math.round(w / aspectRatio);
      heightInput.value = String(h);
    }
    scheduleResize();
  }

  function onHeightChange(): void {
    if (!originalImage) return;
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

  function resize(): void {
    if (!originalImage) return;

    const w = parseInt(widthInput.value, 10) || 1;
    const h = parseInt(heightInput.value, 10) || 1;
    const mime = getOutputMimeType();
    const quality = parseFloat(qualityInput.value);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.drawImage(originalImage, 0, 0, w, h);

    const qualityArg = mime === 'image/png' ? undefined : quality;

    canvas.toBlob((blob) => {
      if (!blob) return;

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

  // Prevent default browser behavior for drag events on the entire document
  // This prevents the browser from opening dragged images in a new tab
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
  });

  async function fetchAndLoadImage(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      if (blob.type.startsWith('image/')) {
        // Create a File from the blob with a meaningful name
        const fileName = url.split('/').pop()?.split('?')[0] || 'image.jpg';
        const file = new File([blob], fileName, { type: blob.type });
        handleFile(file);
      }
    } catch (err) {
      console.error('Failed to load dragged image:', err);
    }
  }

  downloadBtn.addEventListener('click', () => {
    if (!resizedBlob || !originalFile) return;

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

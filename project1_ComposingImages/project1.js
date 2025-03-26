// bgImg is the background image to be modified.
// fgImg is the foreground image.
// fgOpac is the opacity of the foreground image.
// fgPos is the position of the foreground image in pixels. It can be negative and (0,0) means the top-left pixels of the foreground and background are aligned.
function composite(bgImg, fgImg, fgOpac, fgPos) {
    const bgData = bgImg.data;
    const fgData = fgImg.data;
    const fgWidth = fgImg.width;
    const fgHeight = fgImg.height;
    const bgWidth = bgImg.width;

    for (let y = 0; y < fgHeight; y++) {
        for (let x = 0; x < fgWidth; x++) {
            const fgX = x + fgPos.x;
            const fgY = y + fgPos.y;

            const fgIndex = (y * fgWidth + x) * 4;
            const bgIndex = (fgY * bgWidth + fgX) * 4;

            const fgAlpha = (fgData[fgIndex + 3] / 255) * fgOpac * 0.5; 
            const invAlpha = 1 - fgAlpha;

            bgData[bgIndex] = fgData[fgIndex] * fgAlpha + bgData[bgIndex] * invAlpha;     
            bgData[bgIndex + 1] = fgData[fgIndex + 1] * fgAlpha + bgData[bgIndex + 1] * invAlpha; 
            bgData[bgIndex + 2] = fgData[fgIndex + 2] * fgAlpha + bgData[bgIndex + 2] * invAlpha; 
        }
    }
}



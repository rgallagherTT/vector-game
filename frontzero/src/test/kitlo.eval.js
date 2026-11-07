(async () => { const F = window.FZ; const wait = (ms) => new Promise((r) => setTimeout(r, ms)); for (let i = 0; i < 40 && !(F.UI.root); i++) await wait(250);
  F.UI.armOp = 'bastion'; F.UI.open('armoury'); await wait(5000); return { rig: !!F.UI.figRig, img: F.UI.root.querySelectorAll('.ls img').length }; })()

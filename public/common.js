// apply theme as early as possible
(function(){
  try{
    const stored = localStorage.getItem('theme');
    if(stored === 'dark'){ document.documentElement.classList.add('dark'); }
    else if(stored === 'light'){ document.documentElement.classList.remove('dark'); }
    else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if(prefersDark) document.documentElement.classList.add('dark');
    }
  }catch(e){ }
})();

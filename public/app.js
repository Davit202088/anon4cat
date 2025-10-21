(function(){
  const body=document.body, t=document.getElementById('themeToggle');
  let mode=localStorage.getItem('drugru-theme')||'auto';
  const apply=()=>{body.classList.remove('theme-light','theme-dark','theme-auto'); body.classList.add('theme-'+mode)};
  apply(); t&&t.addEventListener('click',()=>{mode=mode==='auto'?'dark':mode==='dark'?'light':'auto';localStorage.setItem('drugru-theme',mode);apply(); pulse(t);});
  function ripple(e){const b=e.currentTarget,c=document.createElement('span'),r=b.getBoundingClientRect(),s=Math.max(r.width,r.height);c.style.width=c.style.height=s+'px';c.style.left=(e.clientX-r.left-s/2)+'px';c.style.top=(e.clientY-r.top-s/2)+'px';c.className='ripple';b.appendChild(c);c.addEventListener('animationend',()=>c.remove());}
  document.querySelectorAll('[data-ripple]').forEach(b=>b.addEventListener('click',ripple));
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible'); io.unobserve(e.target)}}),{threshold:.12});
  document.querySelectorAll('.reveal,.reveal-delay').forEach(el=>io.observe(el));
  const cont=document.querySelector('.particles');
  if(cont){const n=28; for(let i=0;i<n;i++){const p=document.createElement('span'); p.style.position='absolute'; p.style.width=p.style.height=(2+Math.random()*3)+'px'; p.style.borderRadius='50%'; p.style.background='rgba(255,255,255,'+(0.08+Math.random()*0.18)+')'; p.style.left=Math.random()*100+'%'; p.style.top=Math.random()*100+'%'; p.style.transform='translateZ(0)'; const d=8+Math.random()*12; p.style.animation=`floatY ${d}s ease-in-out ${(-Math.random()*d)}s infinite`; cont.appendChild(p);} const s=document.createElement('style'); s.textContent='@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}'; document.head.appendChild(s) }
  function pulse(el){el.animate([{boxShadow:'0 0 0 0 rgba(122,184,255,.6)'},{boxShadow:'0 0 0 16px rgba(122,184,255,0)'}],{duration:600,easing:'ease-out'})}
})();

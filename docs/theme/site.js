//Small behaviors for the docs page. Loaded at the end of <body>, so the elements
//it looks for already exist.

//Copy buttons for the code blocks.
document.querySelectorAll('.code .copy').forEach((button) => {
  button.addEventListener('click', () => {
    const pre = button.closest('.code').querySelector('pre');
    navigator.clipboard.writeText(pre.innerText).then(() => {
      const original = button.textContent;
      button.textContent = 'Copied';
      setTimeout(() => {
        button.textContent = original;
      }, 1500);
    });
  });
});

//Highlight the nav link for the section currently in view.
const links = new Map();
document.querySelectorAll('nav.side a').forEach((link) => {
  const id = link.getAttribute('href').slice(1);
  links.set(id, link);
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        links.forEach((link) => link.classList.remove('active'));
        const active = links.get(entry.target.id);
        if (active) {
          active.classList.add('active');
        }
      }
    });
  },
  { rootMargin: '-20% 0px -70% 0px' },
);

document.querySelectorAll('main section').forEach((section) => observer.observe(section));

(function () {
  const root = document.querySelector("[data-stockists-carousel]");
  if (!root || !window.LEAFLOCK_STOCKISTS) return;

  const track = root.querySelector(".stockists-carousel__track");
  const dots = root.querySelector(".stockists-carousel__dots");
  if (!track || !dots) return;

  const slides = window.LEAFLOCK_STOCKISTS.slides || [];
  let index = 0;
  let timer;

  function renderSlide(slide) {
    return `
      <div class="stockists-carousel__slide" role="group" aria-roledescription="slide">
        ${slide.logos
          .map(
            (logo) =>
              `<img src="${logo.src}" alt="${logo.name}" loading="lazy" width="180" height="64">`,
          )
          .join("")}
      </div>`;
  }

  track.innerHTML = slides.map(renderSlide).join("");
  dots.innerHTML = slides
    .map(
      (_, i) =>
        `<button type="button" class="stockists-carousel__dot" data-slide="${i}" aria-label="Show stockists slide ${i + 1}"></button>`,
    )
    .join("");

  function setSlide(next) {
    index = (next + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.querySelectorAll(".stockists-carousel__dot").forEach((dot, i) => {
      dot.classList.toggle("is-active", i === index);
      dot.setAttribute("aria-current", i === index ? "true" : "false");
    });
  }

  function startAutoplay() {
    stopAutoplay();
    timer = window.setInterval(() => setSlide(index + 1), 6000);
  }

  function stopAutoplay() {
    if (timer) window.clearInterval(timer);
  }

  dots.addEventListener("click", (event) => {
    const button = event.target.closest("[data-slide]");
    if (!button) return;
    setSlide(Number(button.dataset.slide));
    startAutoplay();
  });

  root.addEventListener("mouseenter", stopAutoplay);
  root.addEventListener("mouseleave", startAutoplay);

  setSlide(0);
  startAutoplay();
})();
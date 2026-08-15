(() => {
  const originalNormalizedInteger = normalizedInteger;
  normalizedInteger = (value, minimum, maximum, fallback) => {
    if (maximum !== 1_000) {
      return originalNormalizedInteger(value, minimum, maximum, fallback);
    }

    const number = Number(value);
    return Number.isSafeInteger(number) && number >= minimum ? number : fallback;
  };

  document.querySelector("#auto-add-limit")?.removeAttribute("max");
})();

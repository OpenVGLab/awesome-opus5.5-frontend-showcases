const e=new URLSearchParams(location.search).get("email"),t=document.querySelector("[data-confirm]");e&&t&&(t.textContent=`Thanks for subscribing! A confirmation email is on its way to ${e}.`);

import './style.css'


document.querySelector('#app').innerHTML = `
  <div id="navBar">
        <button id="backButton"><i class="material-icons-outlined">arrow_back</i"></button>
        <button id="homeButton"><i class="material-icons-outlined">home</i></button>
        <button id="printButton"><i class="material-icons-outlined">print</i></button>
        <button id="forwardButton"><i class="material-icons-outlined">arrow_forward</i"></button>
        <span id="debugVersion"></span>
        <div id="tabBar"></div>
        <button id="endSessionButton"><i class="material-icons-outlined">logout</i></button>
    </div>
  <div id="webviewStack"></div>
  <script src="browser.js"></script>
`



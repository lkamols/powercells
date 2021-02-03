'use strict'

const switcher = document.querySelector('.btn');

switcher.addEventListener('click', function() {
    
    document.getElementById("start-msg").style.visibility = "visible";

    console.log('process started');
})
function keyhandler(){
if(event.keyCode===65)
framel();
if(event.keyCode===87)
frameu();
if(event.keyCode===68)
framer();
if(event.keyCode===83)
framed();
}




var HP = 500;
/*function checkCollision(hitboxId, hurtboxId) {
  const hitbox = document.getElementById(hitboxId).getBoundingClientRect();
  const hurtbox = document.getElementById(hurtboxId).getBoundingClientRect();

   Check if the rectangles overlap
  const isColliding = !(
    hitbox.right < hurtbox.left ||
    hitbox.left > hurtbox.right ||
    hitbox.bottom < hurtbox.top ||
    hitbox.top > hurtbox.bottom
  );

  if (isColliding) {
    triggerDamage();
  }
}

function triggerDamage() {
  console.log("Ouch! Hurtbox was hit!");
  
}*/



let posX = 0; 
let posY = 0;
const speed = 2; // Adjust this number to increase or decrease speed

function framel() { 
  posX -= speed; // Move left (decrease X)
  hurtbox.style.left = posX + 'px'; 
} 

function framer() { 
  posX += speed; // Move right (increase X)
  hurtbox.style.left = posX + 'px'; // Keep using .left to update horizontal position
} 

function frameu() { 
  posY -= speed; // Move up (decrease Y)
  hurtbox.style.top = posY + 'px'; 
} 

function framed() { 
  posY += speed; // Move down (increase Y)
  hurtbox.style.top = posY + 'px'; // Keep using .top to update vertical position
} 

window.addEventListener("keydown", keyhandler, false);s
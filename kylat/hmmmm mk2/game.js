class Char {
  constructor(name, baseHP, charclass, baseSTR, basePD, baseMD, baseINT, maxlevel, xpcurvetype, xpcurveM) {
    this.name = name;
    this.class = charclass;
    this.baseHP = baseHP;
    this.baseINT = baseINT;
    this.baseMD = baseMD;
    this.currentxp = 0;
    this.maxlevel = maxlevel;
    this.baseSTR = baseSTR;
    this.basePD = basePD;
    this.xpcurvetype = xpcurvetype;
    this.xpcurveM = xpcurveM;
    this.currentlvl = 1;
    
    this.equipment = {
      head: null,
      leftHand: null,
      body: null,
      rightHand: null,
      misc: Array(12).fill(null) 
    };
  }
}

class Party {
  constructor(...char) {
    this.members = char;
  }
}

function givexp(char, xpammount) {
  if (char.maxlevel > char.currentlvl) {
    char.currentxp += xpammount;
    
    while (char.xpcurvetype === "linear" && char.currentlvl * char.xpcurveM <= char.currentxp && char.currentlvl < char.maxlevel) {
      char.currentlvl++;
    }
    while (char.xpcurvetype === "exponential" && Math.pow(char.currentlvl, char.xpcurveM) <= char.currentxp && char.currentlvl < char.maxlevel) {
      char.currentlvl++;
    }
  }
}

class MenuManager {
  static currentMenu = null;

  static setActive(menu) {
    if (MenuManager.currentMenu && MenuManager.currentMenu !== menu) {
      MenuManager.currentMenu.close();
    }
    MenuManager.currentMenu = menu;
  }

  static clearActive(menu) {
    if (MenuManager.currentMenu === menu) {
      MenuManager.currentMenu = null;
    }
  }
}

class Menu {
  constructor(toggleKey) {
    this.isOpen = false;
    this.toggleKey = toggleKey; 
    
    this.menuElement = document.createElement('div');
    this.menuElement.className = "menu-window hidden"; 
    
    this.tabContainer = document.createElement('div');
    this.tabContainer.className = "menu-tabs-header";
    this.menuElement.appendChild(this.tabContainer);

    this.contentContainer = document.createElement('div');
    this.contentContainer.className = "menu-content-body";
    this.menuElement.appendChild(this.contentContainer);

    document.body.appendChild(this.menuElement);

    window.addEventListener("keydown", (e) => {
      if (this.toggleKey && e.key === this.toggleKey) this.toggle();
    });
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    MenuManager.setActive(this); 
    this.isOpen = true;
    this.menuElement.classList.remove('hidden');
  }

  close() {
    this.isOpen = false;
    this.menuElement.classList.add('hidden');
    MenuManager.clearActive(this);
  }

  addTab(tabInstance) {
    this.tabContainer.appendChild(tabInstance.button);
    
    if (this.tabContainer.children.length === 1) {
      tabInstance.select(this.contentContainer);
    }

    tabInstance.button.addEventListener('click', () => {
      this.contentContainer.innerHTML = '';
      tabInstance.select(this.contentContainer);
    });
  }
}

class MenuTab {
  constructor(name, renderFunction) {
    this.name = name;
    this.renderFunction = renderFunction; 

    this.button = document.createElement('button');
    this.button.className = "menu-tab-btn";
    this.button.innerText = name;
  }

  select(container) {
    this.renderFunction(container);
  }
}

class CharacterMenu extends Menu {
  constructor(toggleKey, partyInstance) {
    super(toggleKey);
    this.party = partyInstance;
    this.buildCharacterTabs();
  }

  buildCharacterTabs() {
    this.party.members.forEach(character => {
      const charTab = new MenuTab(character.name, (container) => {
        this.renderCharacterSubMenu(container, character);
      });
      this.addTab(charTab);
    });
  }

  renderCharacterSubMenu(container, character) {
    // REMOVED ALL BACKSLASHES TO FIX HTML RENDERING
    container.innerHTML = `
      <div class="character-equipment-screen">
        
        <div class="char-header">
          <h2>${character.name}</h2>
          <span class="char-class">Lvl ${character.currentlvl} ${character.class || 'No Class'}</span>
        </div>

        <div class="paperdoll-container">
          <div class="slot-label label-head">Head Slot</div>
          <div class="equip-slot slot-head" id="slot-head-${character.name}">
            ${character.equipment.head || '[ Head Item ]'}
          </div>

          <div class="slot-label label-left">Left Hand</div>
          <div class="equip-slot slot-left-hand" id="slot-left-${character.name}">
            ${character.equipment.leftHand || '[ Left Hand ]'}
          </div>

          <div class="char-sprite-box">
            <div class="char-body-visual">👤</div>
            <div class="equip-slot slot-body" id="slot-body-${character.name}">
              ${character.equipment.body || '[ Body Armor ]'}
            </div>
          </div>

          <div class="slot-label label-right">Right Hand</div>
          <div class="equip-slot slot-right-hand" id="slot-right-${character.name}">
            ${character.equipment.rightHand || '[ Right Hand ]'}
          </div>
        </div>

        <div class="misc-equipment-section">
          <div class="misc-label">Misc Equipables / Armor</div>
          <div class="misc-grid">
            ${character.equipment.misc.map((item, index) => `
              <div class="misc-slot" id="slot-misc-index-{character.name}">
                \${item || ''}
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;

    container.querySelectorAll('.equip-slot, .misc-slot').forEach(slot => {
      slot.addEventListener('click', (e) => {
        console.log(`Clicked slot ID: ${e.currentTarget.id} for character: ${character.name}`);
      });
    });
  }
}

// Fix and restore your game map array data loop structure
const first = document.getElementById("first");
if (first) {
  const map1 = [,
 ,
    [1,1,1,1,1,1,0,0,0,0]
  ];

  const htmlString = map1.map(row => `
    <div class="tile-row">
      ${row.map(cell => `<div class="tile type-\${cell}"></div>`).join('')}
    </div>
  `).join('');
  first.innerHTML = htmlString;
}

// Initialize Menu Instances
const inv = new Menu('i'); 
let guy = new Char("h", 100, "Warrior", 10, 10, 5, 5, 50, "linear", 10);
let guy2 = new Char("apple", 80, "Mage", 4, 5, 12, 15, 50, "exponential", 2);
let guy3 = new Char("orange", 90, "Rogue", 8, 7, 6, 7, 50, "linear", 8);
let guy4 = new Char("pear", 110, "Cleric", 6, 9, 10, 8, 50, "linear", 9);

let party1 = new Party(guy, guy2, guy3, guy4);
const cm = new CharacterMenu("c", party1);

export class Char {
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
  }
}

export class Party {
  constructor(...char) {
    this.members = char;
  }
}

export function givexp(char, xpammount) {
  if (char.maxlevel > char.currentlvl) {
    char.currentxp += xpammount;
    
    // BUG FIX: Changed 'xpcurveM' to 'char.xpcurveM'
    while (char.xpcurvetype === "linear" && char.currentlvl * char.xpcurveM <= char.currentxp && char.currentlvl < char.maxlevel) {
      char.currentlvl++;
    }
    while (char.xpcurvetype === "exponential" && Math.pow(char.currentlvl, char.xpcurveM) <= char.currentxp && char.currentlvl < char.maxlevel) {
      char.currentlvl++;
    }
  }
}

export class MenuManager {
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

export class Menu {
  constructor(toggleKey) {
    this.isOpen = false;
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
      if (e.key === toggleKey) this.toggle();
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

    this.buttonClickListener = () => {
      this.contentContainer.innerHTML = '';
      tabInstance.select(this.contentContainer);
    };
    
    tabInstance.button.addEventListener('click', this.buttonClickListener);
  }
}

export class MenuTab {
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

// NEW: A dedicated character menu constructor that hooks up to your Party data
export class CharacterMenu extends Menu {
  constructor(toggleKey, partyInstance) {
    super(toggleKey);
    this.party = partyInstance;
    this.buildCharacterTabs();
  }

  buildCharacterTabs() {
    this.party.members.forEach(character => {
      // Create a tab for every character in the party automatically
      const charTab = new MenuTab(character.name, (container) => {
        this.renderCharacterSubMenu(container, character);
      });
      this.addTab(charTab);
    });
  }

  renderCharacterSubMenu(container, character) {
    // Generate layout with nested sub-sections for character management
    container.innerHTML = `
      <div class="character-profile">
        <h2>${character.name} <span class="lvl">Lvl ${character.currentlvl}</span></h2>
        <p class="class-title">${character.class}</p>
        <div class="stats-grid">
          <div>HP: ${character.baseHP}</div>
          <div>STR: ${character.baseSTR}</div>
          <div>INT: ${character.baseINT}</div>
          <div>PD: ${character.basePD}</div>
          <div>MD: ${character.baseMD}</div>
          <div>XP: ${character.currentxp}</div>
        </div>
        <div class="character-sub-actions">
          <button class="sub-action-btn" id="equip-btn-${character.name}">Manage Equipment</button>
          <button class="sub-action-btn" id="skills-btn-${character.name}">View Skills</button>
        </div>
      </div>
    `;

    // Hook up specific events for the inner sub-menu buttons
    container.querySelector(`#equip-btn-${character.name}`).addEventListener('click', () => {
      alert(`Opening equipment screen for ${character.name}`);
    });
  }
}

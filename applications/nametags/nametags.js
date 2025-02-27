//
// Copyright 2023 Overte e.V.
//
// Written by Armored Dragon
// Distributed under the Apache License, Version 2.0.
// See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html

let user_nametags = {};
let user_uuids = [];
let visible = Settings.getValue("Nametags_toggle", true);
let maximum_name_length = 50;
let last_camera_mode = Camera.mode;
let check_interval;

const logs = (info) => console.log("[NAMETAGS] " + info);

// New user connected
AvatarManager.avatarAddedEvent.connect(reset);

function reset() {
  clear();
  startup();
}

function startup() {
  const include_self = !HMD.active && !Camera.mode.includes("first person");

  user_uuids = AvatarList.getAvatarIdentifiers();
  if (include_self) user_uuids.push(MyAvatar.sessionUUID);
  user_uuids = user_uuids.filter((uuid) => uuid); // Remove empty, undefined values from array

  user_uuids.forEach((avatar) => {
    let uuid = avatar;
    if (user_nametags[uuid]) return;
    const definite_avatar = AvatarList.getAvatar(uuid);
    const display_name = definite_avatar.displayName ? definite_avatar.displayName.substring(0, maximum_name_length) : "Anonymous";

    const headJointIndex = definite_avatar.getJointIndex("Head");
    const jointInObjectFrame = definite_avatar.getAbsoluteJointTranslationInObjectFrame(headJointIndex);

    user_nametags[uuid] = { overlay: { text: {}, background: {} } };
    user_nametags[uuid].overlay.text = Entities.addEntity(
      {
        type: "Text",
        text: display_name,
        backgroundAlpha: 0.0,
        billboardMode: "full",
        unlit: true,
        parentID: uuid,
        position: Vec3.sum(definite_avatar.position, { x: 0, y: 0.4 + jointInObjectFrame.y, z: 0 }),
        visible: true,
        isSolid: false,
        topMargin: 0.025,
        alignment: "center",
        lineHeight: 0.1,
      },
      "local"
    );
    user_nametags[uuid].overlay.background = Entities.addEntity(
      {
        type: "Image",
        dimensions: { x: 0.8, y: 0.2, z: 0.1 },
        emissive: true,
        alpha: 0.8,
        keepAspectRatio: false,
        position: Vec3.sum(definite_avatar.position, { x: 0, y: 0.4 + jointInObjectFrame.y, z: 0 }),
        parentID: user_nametags[uuid].overlay.text,
        billboardMode: "full",
        imageURL: Script.resolvePath("./assets/badge.svg"),
      },
      "local"
    );

    // We need to have this on a timeout because "textSize" can not be determined instantly after the entity was created.
    // https://apidocs.overte.org/Entities.html#.textSize
    Script.setTimeout(() => {
      let textSize = Entities.textSize(user_nametags[uuid].overlay.text, display_name);
      Entities.editEntity(user_nametags[uuid].overlay.text, { dimensions: { x: textSize.width + 0.25, y: textSize.height - 0.05, z: 0.1 } });
      Entities.editEntity(user_nametags[uuid].overlay.background, {
        dimensions: { x: Math.max(textSize.width + 0.25, 0.6), y: textSize.height - 0.05, z: 0.1 },
      });
    }, 100);

    check_interval = Script.setInterval(adjustNameTag, 5000);
  });
}
function clear() {
  for (let i = 0; Object.keys(user_nametags).length > i; i++) {
    Entities.deleteEntity(user_nametags[Object.keys(user_nametags)[i]].overlay.text);
    Entities.deleteEntity(user_nametags[Object.keys(user_nametags)[i]].overlay.background);
  }
  user_uuids = {};
  user_nametags = {};
  Script.clearInterval(adjustNameTag);
}
function adjustNameTag() {
  const user_list = Object.keys(user_nametags);

  user_list.forEach((uuid) => {
    const definite_avatar = AvatarList.getAvatar(uuid);
    const display_name = definite_avatar.displayName ? definite_avatar.displayName.substring(0, maximum_name_length) : "Anonymous";
    const headJointIndex = definite_avatar.getJointIndex("Head");
    const jointInObjectFrame = definite_avatar.getAbsoluteJointTranslationInObjectFrame(headJointIndex);

    Entities.editEntity(user_nametags[uuid].overlay.background, {
      position: Vec3.sum(definite_avatar.position, { x: 0, y: 0.4 + jointInObjectFrame.y, z: 0 }),
    });
    Entities.editEntity(user_nametags[uuid].overlay.text, {
      position: Vec3.sum(definite_avatar.position, { x: 0, y: 0.4 + jointInObjectFrame.y, z: 0 }),
      text: display_name,
    });

    // // We need to have this on a timeout because "textSize" can not be determined instantly after the entity was created.
    // // https://apidocs.overte.org/Entities.html#.textSize
    Script.setTimeout(() => {
      let textSize = Entities.textSize(user_nametags[uuid].overlay.text, display_name);
      Entities.editEntity(user_nametags[uuid].overlay.text, { dimensions: { x: textSize.width + 0.25, y: textSize.height - 0.05, z: 0.1 } });
      Entities.editEntity(user_nametags[uuid].overlay.background, {
        dimensions: { x: Math.max(textSize.width + 0.25, 0.6), y: textSize.height - 0.05, z: 0.1 },
      });
    }, 100);
  });

  if (last_camera_mode !== Camera.mode) {
    reset();
    last_camera_mode = Camera.mode;
  }
}
function scriptEnding() {
  clear();
  tablet.removeButton(tabletButton);
  Menu.removeMenuItem("View", "Nametags");
}
function setVisible(visible) {
  if (visible !== isVisible) {
    isVisible = visible;
    if (isVisible) {
      startUpdating();
    } else {
      stopUpdating();
    }
    if (button) {
      button.editProperties({ isActive: isVisible });
    }
  }
}
function toggleState() {
  visible = !visible;

  tabletButton.editProperties({ isActive: visible });

  clear();

  if (visible) startup();
  Settings.setValue("Nametags_toggle", visible);
}
function toggleStateMenu() {
  let is_checked = Menu.isOptionChecked("Nametags");
  if (is_checked !== visible) toggleState();

  // Toolbar
  tabletButton.editProperties({ isActive: visible });
}

// Tablet icon
let tablet = Tablet.getTablet("com.highfidelity.interface.tablet.system");
let tabletButton = tablet.addButton({
  icon: Script.resolvePath("./assets/nametags-i.svg"),
  activeIcon: Script.resolvePath("./assets/nametags-a.svg"),
  text: "NAMETAGS",
  isActive: visible,
});
// Menu item
Menu.addMenuItem({
  menuName: "View",
  menuItemName: "Nametags",
  shortcutKey: "CTRL+N",
  isCheckable: true,
  isChecked: visible,
});
Menu.menuItemEvent.connect(toggleStateMenu);
tabletButton.clicked.connect(toggleState);
Script.scriptEnding.connect(scriptEnding);

if (visible) {
  startup();
  tabletButton.editProperties({ isActive: visible });
  toggleStateMenu();
}

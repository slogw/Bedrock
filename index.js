import { world, system, ItemStack, ItemTypes } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { EntityEquippableComponent, EquipmentSlot } from "@minecraft/server";

function createAir() {
    return new ItemStack("minecraft:air", 1);
}

function getEquipMode(player) {
    const mode = player.getDynamicProperty("equipMode");
    return typeof mode === "string" ? mode : "none";
}

function setEquipMode(player, mode) {
    player.setDynamicProperty("equipMode", mode);
}

function getTotemOptions(player) {
    return {
        alert: !!player.getDynamicProperty("totemAlert"),
        count: !!player.getDynamicProperty("totemCount"),
        hideMessage: !!player.getDynamicProperty("totemHideMessage"),
    };
}

function setTotemOption(player, key, value) {
    player.setDynamicProperty(key, value);
}

function getReadableMode(mode) {
    switch (mode) {
        case "swap-totem": return "§eSwap Totem";
        case "swap-all": return "§sSwap All Items";
        case "swap-shield": return "§tSwap Shield";
        default: return "§cNot Configured";
    }
}

async function openConfigMenu(player) {
    const currentMode = getEquipMode(player);

    const options = {
        "swap-totem": currentMode === "swap-totem" ? "§aON" : "§cOFF",
        "swap-shield": currentMode === "swap-shield" ? "§aON" : "§cOFF",
        "swap-all": currentMode === "swap-all" ? "§aON" : "§cOFF"
    };

    const form = new ActionFormData()
        .title("Configuration")
        .body(`Current mode: ${getReadableMode(currentMode)}`)
        .button(`Swap Totem: ${options["swap-totem"]}`)
        .button(`Swap Shield: ${options["swap-shield"]}`)
        .button(`Swap All Items: ${options["swap-all"]}`)
        .button("Totem Options", "textures/items/totem")
        .button("Close", "textures/blocks/barrier");

    const response = await form.show(player);
    if (response.canceled || response.selection === 4) return;

    if (response.selection === 3) {
        openTotemOptionsMenu(player);
        return;
    }

    const modeMap = ["swap-totem", "swap-shield", "swap-all"];
    const selectedMode = modeMap[response.selection];

    setEquipMode(player, selectedMode);
    player.sendMessage(`selected mode: ${getReadableMode(selectedMode)}`);
}

async function openTotemOptionsMenu(player) {
    const options = getTotemOptions(player);

    const form = new ActionFormData()
        .title("Totem Options")
        .body("Toggle features related to totem use")
        .button(`Totem Alert: ${options.alert ? "§aYES" : "§cNO"}`)
        .button(`Totem Count: ${options.count ? "§aYES" : "§cNO"}`)
        .button(`Show Totem Message: ${!options.hideMessage ? "§aYES" : "§cNO"}`)
        .button("Back")
        .button("Close", "textures/blocks/barrier");

    const response = await form.show(player);
    if (response.canceled || response.selection === 4) return;
    if (response.selection === 3) {
        openConfigMenu(player);
        return;
    }

    const keys = ["totemAlert", "totemCount", "totemHideMessage"];
    const currentValue = player.getDynamicProperty(keys[response.selection]);
    setTotemOption(player, keys[response.selection], !currentValue);
    system.run(() => openTotemOptionsMenu(player));
}

async function handleEquipItem(player, itemStack) {
    const validItems = ["minecraft:totem_of_undying", "minecraft:shield"];
    if (!validItems.includes(itemStack.typeId)) return;

    const mode = getEquipMode(player);
    if (mode === "none") {
        player.sendMessage("§cPlease configure your mode using the config item first");
        return;
    }

    const equipment = player.getComponent(EntityEquippableComponent.componentId);
    if (!equipment) return;

    const offhand = equipment.getEquipment(EquipmentSlot.Offhand);
    const backup = offhand ?? createAir();

    if (
        (mode === "swap-totem" && itemStack.typeId === "minecraft:totem_of_undying") ||
        (mode === "swap-shield" && itemStack.typeId === "minecraft:shield") ||
        mode === "swap-all"
    ) {
        if (offhand && offhand.typeId === itemStack.typeId) {
            player.sendMessage("§cThis item is already in your offhand");
            return;
        }
        await equipment.setEquipment(EquipmentSlot.Offhand, itemStack);
        await equipment.setEquipment(EquipmentSlot.Mainhand, backup);
    }
}

world.beforeEvents.itemUse.subscribe(({ itemStack, source: player }) => {
    if (!itemStack || !player) return;

    if (itemStack.typeId === "lskw:config_item") {
        system.run(() => openConfigMenu(player));
        return;
    }

    system.run(() => handleEquipItem(player, itemStack));
});

world.afterEvents.entityHurt.subscribe((event) => {
    const player = event.hurtEntity;
    const damage = event.damage;
    const source = event.damageSource;

    if (player.typeId !== 'minecraft:player') return;
    if (damage > 0 || source.cause !== 'none') return;

    let count = player.getDynamicProperty("totemUseCount") || 0;
    count++;
    player.setDynamicProperty("totemUseCount", count);

    const alert = !!player.getDynamicProperty("totemAlert");
    const countEnabled = !!player.getDynamicProperty("totemCount");
    const hideMessage = !!player.getDynamicProperty("totemHideMessage");

    if (hideMessage) return;

    let message = `${player.name} used a §eTotem Of Undying§r`;
    if (countEnabled) message += ` §8[§r§vTotal§r: §e${count}§8]§r`;

    if (alert) {
        world.sendMessage(message);
    }
});

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    if (!player || !event.initialSpawn) return;

    const alreadyJoined = player.getDynamicProperty("hasJoinedBefore");
    if (alreadyJoined) return;

    player.setDynamicProperty("hasJoinedBefore", true);

    const compass = new ItemStack(ItemTypes.get("lskw:config_item"), 1);
    player.getComponent("minecraft:inventory").container.addItem(compass);
    player.sendMessage("§v¡Welcome!§r use the §qconfig item§r to configure addon options.");
});
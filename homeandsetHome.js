import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { ItemStack, ItemTypes } from "@minecraft/server";

const maxHomes = 5;
const dimensionNames = {
    overworld: "§aOverworld§r",
    nether: "§cNether§r",
    "the_end": "§5The end§r"
};

function getHomes(player) {
    return JSON.parse(player.getDynamicProperty("homes") ?? "[]");
}

function setHomes(player, homes) {
    player.setDynamicProperty("homes", JSON.stringify(homes));
}

function formatHomeButton(home) {
    const dim = dimensionNames[home.dimension] || home.dimension;
    return `${home.name} | ${dim}\nx: ${home.x} y: ${home.y} z: ${home.z}`;
}

function openMainMenu(player) {
    const form = new ActionFormData()
        .title("SetHome Menu")
        .body("Choose an option")
        .button("Set Home")
        .button("Teleport to Home")
        .button("Delete Home")
        .button("Close", "textures/blocks/barrier");

    form.show(player).then(res => {
        if (res.canceled) return;

        switch (res.selection) {
            case 0: openSetHome(player); break;
            case 1: openTeleportMenu(player); break;
            case 2: openDeleteMenu(player); break;
        }
    });
}

function openSetHome(player) {
    const homes = getHomes(player);
    if (homes.length >= maxHomes) {
        player.sendMessage("§cYou have reached the maximum number of homes.");
        return;
    }

    const homeNameForm = new ModalFormData();
    homeNameForm.title("Set Home Name");
    homeNameForm.textField("Enter a home name", " ");
    homeNameForm.submitButton("Give it a name");

    homeNameForm.show(player).then((data) => {
        if (data.canceled || !data.formValues[0]) {
            player.sendMessage("§r§cYou must assign a name to your home.");
            return;
        }

        const customHomeName = data.formValues[0].trim();
        const pos = player.location;
        const dim = player.dimension.id.replace("minecraft:", "");

        homes.push({ name: customHomeName, x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z), dimension: dim });
        setHomes(player, homes);

        player.sendMessage(`§rHome "${customHomeName}" set in the ${dim}.`);
    });
}

function openTeleportMenu(player) {
    const homes = getHomes(player);
    const form = new ActionFormData()
        .title("Teleport to Home");

    homes.forEach(home => {
        form.button(formatHomeButton(home));
    });

    while (homes.length < maxHomes) {
        form.button("[Empty Slot]");
        homes.push(null);
    }

    form.button("Cancel", "textures/blocks/barrier");

    form.show(player).then(res => {
        if (res.canceled || res.selection === homes.length) {
            player.sendMessage("§cYou must select an option to teleport.");
            return;
        }

        const selected = homes[res.selection];
        if (!selected) {
            player.sendMessage("§cYou must create a home before teleporting.");
            return;
        }

        const dim = world.getDimension(selected.dimension);
        player.teleport({ x: selected.x, y: selected.y, z: selected.z }, { dimension: dim });
        player.sendMessage(`§rTeleported to home "${selected.name}" in the ${dimensionNames[selected.dimension]}`);
    });
}

function openDeleteMenu(player) {
    const homes = getHomes(player);
    const form = new ActionFormData()
        .title("Delete Home");

    homes.forEach(home => {
        form.button(formatHomeButton(home));
    });

    while (homes.length < maxHomes) {
        form.button("[Empty Slot]");
        homes.push(null);
    }

    form.button("Cancel", "textures/blocks/barrier");

    form.show(player).then(res => {
        if (res.canceled || res.selection === homes.length) return;
        if (!homes[res.selection]) {
            player.sendMessage("§cYou cannot delete a empty Slot.");
            return;
        }

        homes.splice(res.selection, 1);
        setHomes(player, homes.filter(Boolean));
        player.sendMessage("§cHome deleted.");
    });
}

world.beforeEvents.itemUse.subscribe(({ itemStack, source: player }) => {
    if (!itemStack || !player) return;
    if (itemStack.typeId !== "lskw:sethome_item") return;
    system.run(() => openMainMenu(player));
});

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    if (!player || !event.initialSpawn) return;

    const alreadyJoined = player.getDynamicProperty("hasJoinedBefore");
    if (alreadyJoined) return;

    player.setDynamicProperty("hasJoinedBefore", true);

    const compass = new ItemStack(ItemTypes.get("lskw:sethome_item"), 1);
    player.getComponent("minecraft:inventory").container.addItem(compass);
    player.sendMessage("You have been granted a §qspecial item§r that enables the addon features for your first time entering. If you lose it, you will have to craft it using a §t1x §vcompass§r and §t1x §vpaper§r to craft another §qspecial item§r");
});
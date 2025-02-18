import { HomeAssistant } from "custom-card-helpers";
import { HassEntity } from "home-assistant-js-websocket";

import { EntityRegistryEntry, Language, TileConfig } from "../../types/types";
import { localize } from "../../localize/localize";
import { getAllEntitiesFromTheSameDevice } from "../../utils";
import { PlatformGenerator } from "./platform-generator";

export class TilesGenerator {
    public static generate(
        hass: HomeAssistant,
        vacuumEntity: string,
        platform: string,
        language: Language,
    ): Promise<TileConfig[]> {
        if (!hass) return new Promise<TileConfig[]>(resolve => resolve([]));
        const useNewGenerator = PlatformGenerator.usesSensors(hass, platform);

        const state = hass.states[vacuumEntity];
        const tiles: TileConfig[] = [];

        tiles.push(...this.getCommonTiles(state, vacuumEntity, language));
        if (useNewGenerator) {
            return this.addTilesFromSensors(hass, vacuumEntity, platform, tiles, language);
        } else {
            return new Promise<TileConfig[]>(resolve =>
                resolve(this.addTilesFromAttributes(state, vacuumEntity, platform, tiles, language)),
            );
        }
    }

    private static getCommonTiles(state: HassEntity, vacuumEntity: string, language: Language): TileConfig[] {
        const tiles: TileConfig[] = [];
        if (state && "status" in state.attributes)
            tiles.push({
                entity: vacuumEntity,
                label: localize("label.status", language),
                attribute: "status",
                icon: "mdi:robot-vacuum",
            } as unknown as TileConfig);
        if (state && "battery_level" in state.attributes && "battery_icon" in state.attributes)
            tiles.push({
                entity: vacuumEntity,
                label: localize("label.battery_level", language),
                attribute: "battery_level",
                icon: state.attributes["battery_icon"],
                unit: "%",
            } as unknown as TileConfig);
        if (state && "battery_level" in state.attributes && !("battery_icon" in state.attributes))
            tiles.push({
                entity: vacuumEntity,
                label: localize("label.battery_level", language),
                attribute: "battery_level",
                icon: "mdi:battery",
                unit: "%",
            } as unknown as TileConfig);
        if (state && "fan_speed" in state.attributes)
            tiles.push({
                entity: vacuumEntity,
                label: localize("label.fan_speed", language),
                attribute: "fan_speed",
                icon: "mdi:fan",
            } as unknown as TileConfig);
        return tiles;
    }

    private static addTilesFromAttributes(
        state: HassEntity,
        vacuumEntity: string,
        platform: string,
        tiles: TileConfig[],
        language: Language,
    ): TileConfig[] {
        PlatformGenerator.getTilesFromAttributesTemplates(platform)
            .filter(t => t.attribute in state.attributes)
            .forEach(t =>
                tiles.push({
                    entity: vacuumEntity,
                    label: localize(t.label, language),
                    attribute: t.attribute,
                    icon: t.icon,
                    unit: t.unit ? localize(t.unit, language) : undefined,
                    precision: t.precision,
                    multiplier: t.multiplier,
                }),
            );
        return tiles;
    }

    private static async addTilesFromSensors(
        hass: HomeAssistant,
        vacuumEntityId: string,
        platform: string,
        tiles: TileConfig[],
        language: Language,
    ): Promise<TileConfig[]> {
        const entityRegistryEntries = (await getAllEntitiesFromTheSameDevice(hass, vacuumEntityId)).filter(
            e => e.disabled_by === null,
        );
        const vacuumUniqueId = entityRegistryEntries.filter(e => e.entity_id === vacuumEntityId)[0].unique_id;
        PlatformGenerator.getTilesFromSensorsTemplates(platform)
            .map(t => ({
                tile: t,
                entity: entityRegistryEntries.filter(e => e.unique_id === `${t.unique_id_prefix}${vacuumUniqueId}`),
            }))
            .flatMap(v => v.entity.map(e => this.mapToTile(e, v.tile.label, v.tile.unit, v.tile.multiplier, language)))
            .forEach(t => tiles.push(t));
        return new Promise<TileConfig[]>(resolve => resolve(tiles));
    }

    private static mapToTile(
        e: EntityRegistryEntry,
        label: string,
        unit: string | undefined,
        multiplier: number | undefined,
        language: Language,
    ): TileConfig {
        return {
            entity: e.entity_id,
            label: localize(label, language),
            icon: e.icon ?? e.original_icon,
            multiplier: multiplier ? multiplier : undefined,
            precision: multiplier ? 1 : undefined,
            unit: unit ? localize(unit, language) : undefined,
        };
    }
}

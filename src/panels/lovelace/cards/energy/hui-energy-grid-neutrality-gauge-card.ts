import { mdiInformation } from "@mdi/js";
import "@polymer/paper-tooltip";
import { UnsubscribeFunc } from "home-assistant-js-websocket";
import { css, CSSResultGroup, html, LitElement, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators";
import { formatNumber } from "../../../../common/string/format_number";
import "../../../../components/ha-card";
import "../../../../components/ha-svg-icon";
import "../../../../components/ha-gauge";
import type { LevelDefinition } from "../../../../components/ha-gauge";
import {
  EnergyData,
  getEnergyDataCollection,
  GridSourceTypeEnergyPreference,
} from "../../../../data/energy";
import { calculateStatisticsSumGrowth } from "../../../../data/history";
import { SubscribeMixin } from "../../../../mixins/subscribe-mixin";
import type { HomeAssistant } from "../../../../types";
import type { LovelaceCard } from "../../types";
import type { EnergyGridGaugeCardConfig } from "../types";
import { severityMap } from "../hui-gauge-card";

const LEVELS: LevelDefinition[] = [
  { level: -1, stroke: severityMap.red },
  { level: -0.2, stroke: severityMap.yellow },
  { level: 0, stroke: severityMap.green },
];

@customElement("hui-energy-grid-neutrality-gauge-card")
class HuiEnergyGridGaugeCard
  extends SubscribeMixin(LitElement)
  implements LovelaceCard
{
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: EnergyGridGaugeCardConfig;

  @state() private _data?: EnergyData;

  public hassSubscribe(): UnsubscribeFunc[] {
    return [
      getEnergyDataCollection(this.hass!, {
        key: this._config?.collection_key,
      }).subscribe((data) => {
        this._data = data;
      }),
    ];
  }

  public getCardSize(): number {
    return 4;
  }

  public setConfig(config: EnergyGridGaugeCardConfig): void {
    this._config = config;
  }

  protected render(): TemplateResult {
    if (!this._config || !this.hass) {
      return html``;
    }

    if (!this._data) {
      return html`Loading...`;
    }

    const prefs = this._data.prefs;
    const gridSource = prefs.energy_sources.find(
      (src) => src.type === "grid"
    ) as GridSourceTypeEnergyPreference | undefined;

    let value: number | undefined;

    if (!gridSource) {
      return html``;
    }

    const consumedFromGrid = calculateStatisticsSumGrowth(
      this._data.stats,
      gridSource.flow_from.map((flow) => flow.stat_energy_from)
    );

    const returnedToGrid = calculateStatisticsSumGrowth(
      this._data.stats,
      gridSource.flow_to.map((flow) => flow.stat_energy_to)
    );

    if (consumedFromGrid !== null && returnedToGrid !== null) {
      if (returnedToGrid > consumedFromGrid) {
        value = 1 - consumedFromGrid / returnedToGrid;
      } else if (returnedToGrid < consumedFromGrid) {
        value = (1 - returnedToGrid / consumedFromGrid) * -1;
      } else {
        value = 0;
      }
    }

    return html`
      <ha-card>
        ${value !== undefined
          ? html`
              <ha-svg-icon id="info" .path=${mdiInformation}></ha-svg-icon>
              <paper-tooltip animation-delay="0" for="info" position="left">
                <span>
                  This card represents your energy dependency.
                  <br /><br />
                  If it's green, it means you produced more energy than that you
                  consumed from the grid. If it's in the red, it means that you
                  relied on the grid for part of your home's energy consumption.
                </span>
              </paper-tooltip>

              <ha-gauge
                min="-1"
                max="1"
                .value=${value}
                .valueText=${formatNumber(
                  Math.abs(returnedToGrid! - consumedFromGrid!),
                  this.hass.locale,
                  { maximumFractionDigits: 2 }
                )}
                .locale=${this.hass!.locale}
                .levels=${LEVELS}
                label="kWh"
                needle
              ></ha-gauge>
              <div class="name">
                ${returnedToGrid! >= consumedFromGrid!
                  ? "Net returned to the grid"
                  : "Net consumed from the grid"}
              </div>
            `
          : "Grid neutrality could not be calculated"}
      </ha-card>
    `;
  }

  static get styles(): CSSResultGroup {
    return css`
      ha-card {
        height: 100%;
        overflow: hidden;
        padding: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        box-sizing: border-box;
      }

      ha-gauge {
        width: 100%;
        max-width: 250px;
      }

      .name {
        text-align: center;
        line-height: initial;
        color: var(--primary-text-color);
        width: 100%;
        font-size: 15px;
        margin-top: 8px;
      }

      ha-svg-icon {
        position: absolute;
        right: 4px;
        top: 4px;
        color: var(--secondary-text-color);
      }
      paper-tooltip > span {
        font-size: 12px;
        line-height: 12px;
      }
      paper-tooltip {
        width: 80%;
        max-width: 250px;
        top: 8px !important;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-energy-grid-neutrality-gauge-card": HuiEnergyGridGaugeCard;
  }
}

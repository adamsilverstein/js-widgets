# Local Weather

A compact card with the current temperature, condition and a three day forecast. Useful for a venue, a club, a travel blog or any site with a home base. No API key or account needed.

```html
<script src="weather.min.js" data-lat="44.05" data-lon="-121.31" data-units="f" data-label="Bend, OR"></script>
```

Leave out `data-lat` and `data-lon` and the card shows a **Use my location** button instead. The browser asks for the visitor's location only after they click it, never on page load.

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-lat` | none | Latitude of the location to show. |
| `data-lon` | none | Longitude of the location to show. |
| `data-units` | From the visitor's locale | `f` for Fahrenheit or `c` for Celsius. Without it, visitors in the US and a few other Fahrenheit regions see `f`, everyone else `c`. |
| `data-label` | none | Place name shown at the top of the card, eg. `Bend, OR`. |

## Third party request

This widget fetches the forecast from [Open-Meteo](https://open-meteo.com/) (`api.open-meteo.com`). The request sends the coordinates and the visitor's IP address to Open-Meteo, so mention it in your privacy policy if you have one. A visitor's own location is rounded to two decimals, about 1 km, before it is sent.

The response is kept in `sessionStorage` for 30 minutes, so further page views in the same tab session make no request. A visitor who shared their location sees it again on later page views in that session without being asked.

Open-Meteo's free API is for **non-commercial use** only, with a fair use limit of about 10,000 requests a day. Commercial sites need an [Open-Meteo API subscription](https://open-meteo.com/en/pricing), which this widget does not support yet. The data is licensed CC BY 4.0, which is why the card links to Open-Meteo.

## Notes

- If the request fails or times out after 8 seconds, the card says the weather is unavailable and the rest of the page is unaffected.
- Condition icons are inline SVG, so they make no image requests. The large icon animates briefly on load, for under five seconds, and not at all when the visitor prefers reduced motion.
- The card takes the page's text color, so it fits light and dark themes.
- The forecast covers the next three days after today, with today's high and low shown under the current temperature.

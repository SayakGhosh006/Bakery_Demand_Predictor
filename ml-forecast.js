'use strict';

const mlWeekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let demoMlModel;

function predictDemoSales(model, productName, date, assumptions, history) {
    const forecastDay = new Date(`${date}T00:00:00Z`);
    const weekAgo = new Date(forecastDay.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const recent = history.filter(record => record.date >= weekAgo && record.date < date);
    const pastSales = recent.find(record => record.date === weekAgo)?.sold;
    const average = recent.length ? recent.reduce((sum, record) => sum + Number(record.sold), 0) / recent.length : null;
    const values = [productName, mlWeekdays[forecastDay.getUTCDay()], Number(assumptions.holiday), Number(Boolean(assumptions.event.trim()))];

    // Match the fitted Python pipeline's one-hot encoding and median imputation.
    let estimate = model.intercept;
    let offset = 0;
    model.categories.forEach((categories, index) => {
        const categoryIndex = categories.indexOf(values[index]);
        if (categoryIndex >= 0) estimate += model.coefficients[offset + categoryIndex];
        offset += categories.length;
    });
    [pastSales, average].forEach((value, index) => {
        estimate += model.coefficients[offset + index] * (value ?? model.medians[index]);
    });
    return { estimate, units: Math.round(Math.max(0, estimate)), recentDays: recent.length };
}

function renderMlForecast() {
    if (!demoMlModel || $('#ml-forecast').hidden) return;
    const assumptions = forecastInputs();
    const date = assumptions.date;
    const status = $('#ml-status');
    const results = $('#ml-results');
    status.textContent = '';
    results.innerHTML = '';

    if (!validDate(date) || date <= demoMlModel.trainedThrough) {
        status.textContent = `Choose a forecast date after ${demoMlModel.trainedThrough}, the last day used to train this model.`;
        return;
    }
    if (!forecastRows.length) {
        status.textContent = 'Load demo data to compare predictions for the four sample products.';
        return;
    }

    status.textContent = `Predicted sales for ${date}`;
    const rows = forecastRows.map(forecastRow => {
        const product = state.products.find(item => item.id === forecastRow.product);
        let demo = 'Product not in demo model';
        if (demoMlModel.categories[0].includes(product.name)) {
            const history = state.records.filter(record => record.product === product.id);
            const prediction = predictDemoSales(demoMlModel, product.name, date, assumptions, history);
            demo = prediction.recentDays ? `<b>${prediction.units}</b> items` : 'Needs sales from the previous 7 days';
        }
        return [esc(product.name), forecastRow.count ? `${forecastRow.predicted} items` : 'No history', demo];
    });
    results.innerHTML = table(['Product', 'Current forecast', 'Demo ML forecast'], rows);
}

const mlButton = $('#try-ml-forecast');
mlButton.onclick = async () => {
    const panel = $('#ml-forecast');
    panel.hidden = !panel.hidden;
    mlButton.setAttribute('aria-expanded', String(!panel.hidden));
    mlButton.textContent = panel.hidden ? 'Try ML forecast' : 'Hide ML forecast';
    if (panel.hidden) return;
    if (demoMlModel) {
        renderMlForecast();
        return;
    }

    mlButton.disabled = true;
    $('#ml-status').textContent = 'Loading demo model…';
    try {
        const response = await fetch('bakery-model.json');
        if (!response.ok) throw Error('Model unavailable');
        const model = await response.json();
        if (model.version !== 1 || model.source !== 'synthetic') throw Error('Unsupported demo model');
        demoMlModel = model;
        renderMlForecast();
    } catch {
        demoMlModel = undefined;
        $('#ml-status').textContent = 'Could not load the demo model. Check that bakery-model.json is deployed next to index.html, then reopen the preview.';
    } finally {
        mlButton.disabled = false;
    }
};

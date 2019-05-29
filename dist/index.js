"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function TriangleTankCalculator(app) {
    var name = 'Triangle fuel/water tank calculator';
    var schema = {
        type: 'object',
        required: [
            'input',
            'minInputValue',
            'maxInputValue',
            'minMappingValue',
            'maxMappingValue',
            'tankDimensionsA',
            'tankDimensionsB',
            'tankDimensionsH',
            'tankInstance',
            'tankType',
            'tankContentType',
            'tankName',
            'multiplier'
        ],
        properties: {
            input: {
                type: 'string',
                title: 'Signal K path to raw fuel sensor data',
                default: 'vessels.self.sensors.fuel.0.raw.value'
            },
            multiplier: {
                type: 'number',
                title: 'A multiplier to modify the output ratio',
                default: 1.0
            },
            tankInstance: {
                type: 'number',
                title: 'Tank instance number',
                default: 0
            },
            tankType: {
                type: 'string',
                title: 'Tank type, e.g. fuel',
                default: 'fuel'
            },
            tankName: {
                type: 'string',
                title: 'Tank name, e.g. Primary',
                default: 'Primary Tank'
            },
            tankContentType: {
                type: 'string',
                title: 'Kind of tank contents, e.g. diesel',
                default: 'diesel'
            },
            minInputValue: {
                type: 'number',
                title: 'Minimum input reading. Lower values are ignored',
                default: 0
            },
            maxInputValue: {
                type: 'number',
                title: 'Maximum input reading. Higher values are ignored',
                default: 500
            },
            minMappingValue: {
                type: 'number',
                title: 'Mapping: minimum value in centimeters',
                default: 0
            },
            maxMappingValue: {
                type: 'number',
                title: 'Mapping: maximum value in centimeters',
                default: 30
            },
            tankDimensionsA: {
                type: 'number',
                title: 'Tank dimensions: A in cm',
                default: 30
            },
            tankDimensionsB: {
                type: 'number',
                title: 'Tank dimensions: B in cm',
                default: 30
            },
            tankDimensionsH: {
                type: 'number',
                title: 'Tank dimensions: H in cm',
                default: 60
            }
        }
    };
    var plugin = {
        name: name,
        schema: schema,
        id: 'triangle-tank-calculator',
        description: name,
        start: function (options) {
            var input = options.input, minInputValue = options.minInputValue, maxInputValue = options.maxInputValue, minMappingValue = options.minMappingValue, maxMappingValue = options.maxMappingValue, tankDimensionsA = options.tankDimensionsA, tankDimensionsB = options.tankDimensionsB, tankDimensionsH = options.tankDimensionsH, tankInstance = options.tankInstance, tankType = options.tankType, tankContentType = options.tankContentType, tankName = options.tankName, multiplier = options.multiplier;
            app.debug("Options: " + JSON.stringify(options, null, 2));
            app.debug("Paths: " + JSON.stringify(app.streambundle.getAvailablePaths(), null, 2));
            var stream = app.streambundle.getSelfStream(input);
            stream.onValue(function (value) {
                app.debug("initial value = " + value);
                var volume = 0;
                var totalVolume = 0.5 * tankDimensionsB * tankDimensionsA * tankDimensionsH;
                var ratio = 0;
                if (value < minInputValue) {
                    value = minInputValue;
                }
                if (value > maxInputValue) {
                    value = maxInputValue;
                }
                app.debug("constrained value = " + value);
                value = mapValue(value, minInputValue, maxInputValue, minMappingValue, maxMappingValue);
                volume = calculateVolume(value, tankDimensionsA, tankDimensionsB, tankDimensionsH);
                app.debug("mapped value = " + value);
                app.debug("volume = " + volume);
                app.debug("total volume = " + totalVolume);
                if (isNaN(value) || isNaN(volume)) {
                    return;
                }
                ratio = volume / totalVolume;
                totalVolume = totalVolume * 0.000001;
                volume = volume * 0.000001;
                app.debug("ratio = " + ratio);
                if (typeof multiplier === 'number' && !isNaN(multiplier) && multiplier > 0) {
                    ratio = ratio * multiplier;
                    app.debug("multiplied ratio = " + ratio);
                }
                app.setProviderStatus("currentLevel = " + ratio.toFixed(2) + ", currentVolume = " + (volume / 0.000001).toFixed(4) + " cm3, capacity = " + (totalVolume / 0.000001).toFixed(4) + " cm3, type = " + tankContentType + ", name = " + tankName);
                app.handleMessage(plugin.id, {
                    context: 'vessels.self',
                    updates: [{
                            source: { label: plugin.id, type: 'sensor' },
                            timestamp: new Date().toISOString(),
                            values: [
                                { path: "tanks." + (tankType || 'fuel') + "." + (tankInstance || 0) + ".currentLevel", value: ratio },
                                { path: "tanks." + (tankType || 'fuel') + "." + (tankInstance || 0) + ".currentVolume", value: volume },
                                { path: "tanks." + (tankType || 'fuel') + "." + (tankInstance || 0) + ".capacity", value: totalVolume },
                                { path: "tanks." + (tankType || 'fuel') + "." + (tankInstance || 0) + ".type", value: tankContentType },
                                { path: "tanks." + (tankType || 'fuel') + "." + (tankInstance || 0) + ".name", value: tankName }
                            ]
                        }]
                });
            });
        },
        stop: function () {
            app.setProviderStatus('Triangle Tank Plugin stopped');
        }
    };
    return plugin;
}
exports.default = TriangleTankCalculator;
var calculateVolume = function (input, a, b, h) {
    var c = 0;
    var bc = 0;
    var a1 = input;
    var b1 = 0;
    c = Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2));
    bc = Math.atan(a / b);
    b1 = a1 * Math.tan(bc);
    return 0.5 * b1 * a1 * h;
};
var mapValue = function (x, in_min, in_max, out_min, out_max) {
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
};
//# sourceMappingURL=index.js.map
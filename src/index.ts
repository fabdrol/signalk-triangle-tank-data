interface ISKPlugin {
  id: string,
  name: string,
  description: string,
  schema: any,
  start: (options:any) => void,
  stop: () => void
}

interface ISKSource {
  label?: string,
  type?: string
}

interface ISKDeltaValue {
  path: string,
  value: any
}

interface ISKDeltaUpdate {
  source?: ISKSource,
  timestamp: string,
  values: ISKDeltaValue[]
}

interface ISKDelta {
  context?: string,
  updates: ISKDeltaUpdate[]
}

interface IPluginOptions {
  input: string,
  minInputValue: number,
  maxInputValue: number,
  minMappingValue: number,
  maxMappingValue: number,
  tankDimensionsA: number,
  tankDimensionsB: number,
  tankDimensionsH: number,
  tankInstance: number,
  tankType: string,
  tankContentType: string,
  tankName: string,
  multiplier: number
}

export default function TriangleTankCalculator (app:any) {
  const name = 'Triangle fuel/water tank calculator'

  const schema = {
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
  }

  const plugin:ISKPlugin = {
    name,
    schema,
    id: 'triangle-tank-calculator',
    description: name,

    start (options:IPluginOptions) {
      const {
        input,
        minInputValue,
        maxInputValue,
        minMappingValue,
        maxMappingValue,
        tankDimensionsA,
        tankDimensionsB,
        tankDimensionsH,
        tankInstance,
        tankType,
        tankContentType,
        tankName,
        multiplier
      } = options

      app.debug(`Options: ${JSON.stringify(options, null, 2)}`)
      app.debug(`Paths: ${JSON.stringify(app.streambundle.getAvailablePaths(), null, 2)}`)

      const stream:any = app.streambundle.getSelfStream(input)

      stream.onValue((value:number) => {
        app.debug(`initial value = ${value}`)
        
        let volume = 0
        let totalVolume = 0.5 * tankDimensionsB * tankDimensionsA * tankDimensionsH
        let ratio = 0

        if (value < minInputValue) {
          value = minInputValue
        }

        if (value > maxInputValue) {
          value = maxInputValue
        }

        app.debug(`constrained value = ${value}`)

        value = mapValue(value, minInputValue, maxInputValue, minMappingValue, maxMappingValue)
        volume = calculateVolume(value, tankDimensionsA, tankDimensionsB, tankDimensionsH)

        app.debug(`mapped value = ${value}`)
        app.debug(`volume = ${volume}`)
        app.debug(`total volume = ${totalVolume}`)

        if (isNaN(value) || isNaN(volume)) {
          return
        }

        // Convert cm cubed volume to m cubed
        ratio = volume / totalVolume
        totalVolume = totalVolume * 0.000001
        volume = volume * 0.000001

        app.debug(`ratio = ${ratio}`)

        if (typeof multiplier === 'number' && !isNaN(multiplier) && multiplier > 0) {
          ratio = ratio * multiplier
          app.debug(`multiplied ratio = ${ratio}`)
        }

        app.setProviderStatus(`currentLevel = ${ratio.toFixed(2)}, currentVolume = ${(volume / 0.000001).toFixed(4)} cm3, capacity = ${(totalVolume / 0.000001).toFixed(4)} cm3, type = ${tankContentType}, name = ${tankName}`)
        app.handleMessage(plugin.id, {
          context: 'vessels.self',
          updates: [{
            source: { label: plugin.id, type: 'sensor' },
            timestamp: new Date().toISOString(),
            values: [
              { path: `tanks.${tankType || 'fuel'}.${tankInstance || 0}.currentLevel`, value: ratio },
              { path: `tanks.${tankType || 'fuel'}.${tankInstance || 0}.currentVolume`, value: volume },
              { path: `tanks.${tankType || 'fuel'}.${tankInstance || 0}.capacity`, value: totalVolume },
              { path: `tanks.${tankType || 'fuel'}.${tankInstance || 0}.type`, value: tankContentType },
              { path: `tanks.${tankType || 'fuel'}.${tankInstance || 0}.name`, value: tankName }
            ]
          }]
        })
      })
    },

    stop () {
      app.setProviderStatus('Triangle Tank Plugin stopped')
    }
  }

  return plugin
}

const calculateVolume = (input:number, a:number, b:number, h:number):number => {
  // Dimension C
  let c:number = 0

  // Angle B-C
  let bc:number = 0
  
  // Smaller triangle of diesel in tank
  let a1:number = input
  let b1:number = 0

  // Step 1, calculate C
  c = Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2))

  // Step 2, calculate angles
  bc = Math.atan(a / b)

  // Step 3, calculate smaller triangle
  b1 = a1 * Math.tan(bc)

  // Step 4, output volume
  return 0.5 * b1 * a1 * h
}

const mapValue = (x:number, in_min:number, in_max:number, out_min:number, out_max:number):number => {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}
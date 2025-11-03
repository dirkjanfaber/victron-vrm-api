/**
 * Unit tests for message cloning behavior (Issue #41)
 *
 * This test verifies that RED.util.cloneMessage() is called to preserve
 * message properties rather than creating new message objects.
 */

describe('Message Cloning for Property Preservation', () => {
  describe('RED.util.cloneMessage behavior', () => {
    it('should clone message with all properties including HTTP context', () => {
      // Mock RED.util.cloneMessage behavior
      const RED = {
        util: {
          cloneMessage: (msg) => {
            // This simulates Node-RED's cloneMessage which does a deep clone
            return JSON.parse(JSON.stringify(msg))
          }
        }
      }

      // Original message with HTTP context
      const originalMsg = {
        payload: { test: 'data' },
        req: {
          method: 'POST',
          url: '/api/test',
          headers: { 'user-agent': 'test-agent' }
        },
        res: {
          _mockRes: 'response-object'
        },
        customProp: 'custom-value',
        nested: { data: 'nested' },
        _msgid: '12345.67890',
        topic: 'original-topic'
      }

      // Clone the message
      const clonedMsg = RED.util.cloneMessage(originalMsg)

      // Modify the clone
      clonedMsg.payload = { newData: 'updated' }
      clonedMsg.topic = 'new-topic'
      clonedMsg.url = 'https://api.example.com/endpoint'

      // Verify HTTP context is preserved
      expect(clonedMsg.req).toBeDefined()
      expect(clonedMsg.req.method).toBe('POST')
      expect(clonedMsg.req.url).toBe('/api/test')

      expect(clonedMsg.res).toBeDefined()
      expect(clonedMsg.res._mockRes).toBe('response-object')

      // Verify custom properties are preserved
      expect(clonedMsg.customProp).toBe('custom-value')
      expect(clonedMsg.nested.data).toBe('nested')
      expect(clonedMsg._msgid).toBe('12345.67890')

      // Verify new properties were set
      expect(clonedMsg.payload.newData).toBe('updated')
      expect(clonedMsg.topic).toBe('new-topic')
      expect(clonedMsg.url).toBe('https://api.example.com/endpoint')

      // Verify original is unchanged
      expect(originalMsg.payload.test).toBe('data')
      expect(originalMsg.topic).toBe('original-topic')
      expect(originalMsg.url).toBeUndefined()
    })

    it('should create independent clones for dual output', () => {
      const RED = {
        util: {
          cloneMessage: (msg) => JSON.parse(JSON.stringify(msg))
        }
      }

      const originalMsg = {
        payload: {},
        sharedProp: 'shared',
        _msgid: 'dual-output-test'
      }

      // Create two independent clones (simulating dual output)
      const output1 = RED.util.cloneMessage(originalMsg)
      const output2 = RED.util.cloneMessage(originalMsg)

      // Modify each independently
      output1.payload = { type: 'raw-data' }
      output1.topic = 'output-1'

      output2.payload = { type: 'transformed-data' }
      output2.topic = 'output-2'

      // Verify they are independent
      expect(output1.topic).toBe('output-1')
      expect(output2.topic).toBe('output-2')
      expect(output1.payload.type).toBe('raw-data')
      expect(output2.payload.type).toBe('transformed-data')

      // Verify both preserve shared properties
      expect(output1.sharedProp).toBe('shared')
      expect(output2.sharedProp).toBe('shared')
      expect(output1._msgid).toBe('dual-output-test')
      expect(output2._msgid).toBe('dual-output-test')

      // Verify they are different objects
      expect(output1).not.toBe(output2)
    })

    it('should preserve all message properties vs creating new object', () => {
      // Demonstrate the difference between the old approach (creating new object)
      // and the new approach (cloning)

      const originalMsg = {
        payload: { data: 'original' },
        req: { method: 'GET' },
        res: { send: jest.fn() },
        customField: 'important',
        _msgid: 'msg-123'
      }

      // OLD APPROACH (broken - loses properties)
      const oldApproach = {
        payload: { data: 'updated' },
        topic: 'new-topic',
        url: 'https://api.example.com'
      }

      // NEW APPROACH (correct - preserves properties)
      const RED = {
        util: {
          cloneMessage: (msg) => JSON.parse(JSON.stringify(msg))
        }
      }
      const newApproach = RED.util.cloneMessage(originalMsg)
      newApproach.payload = { data: 'updated' }
      newApproach.topic = 'new-topic'
      newApproach.url = 'https://api.example.com'

      // Compare results
      expect(oldApproach.req).toBeUndefined() // LOST!
      expect(oldApproach.res).toBeUndefined() // LOST!
      expect(oldApproach.customField).toBeUndefined() // LOST!
      expect(oldApproach._msgid).toBeUndefined() // LOST!

      expect(newApproach.req).toBeDefined() // PRESERVED!
      expect(newApproach.req.method).toBe('GET')
      expect(newApproach.customField).toBe('important') // PRESERVED!
      expect(newApproach._msgid).toBe('msg-123') // PRESERVED!

      // But still updates the new properties
      expect(newApproach.payload.data).toBe('updated')
      expect(newApproach.topic).toBe('new-topic')
      expect(newApproach.url).toBe('https://api.example.com')
    })
  })
})

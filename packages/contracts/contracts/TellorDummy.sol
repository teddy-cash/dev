// Dummy contract to use in place of Tellor Oracle

contract TellorDummy {
  string greeting;

  constructor() public {
    greeting = "Tellor not implemented";
  }

  function greet() public view returns (string memory) {
    return greeting;
  }

 function setGreeting(string memory _greeting) public {
   greeting = _greeting;
 }
}
